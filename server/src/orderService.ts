import {prisma} from "./db.js";
import {emitKitchen,emitRestaurant} from "./realtime.js";

export async function recalcAndCreatePayment(restaurantId:string,sessionId:string,items:{menuItemId:string;quantity:number;notes?:string}[]){
  if(!items.length) throw new Error("Cart is empty");
  const session=await prisma.session.findFirst({where:{id:sessionId,restaurantId,status:"ACTIVE"}});
  if(!session || session.expiresAt<new Date()) throw new Error("Session expired");

  const menuIds=[...new Set(items.map(x=>x.menuItemId))];
  const menu=await prisma.menuItem.findMany({where:{id:{in:menuIds},restaurantId}});
  const byId=new Map(menu.map(x=>[x.id,x]));
  let subtotal=0;

  const normalized=items.map(i=>{
    const m=byId.get(i.menuItemId);
    if(!m || !m.isAvailable) throw new Error(`Item unavailable: ${i.menuItemId}`);
    if(!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>50) throw new Error("Invalid quantity");
    subtotal += Number(m.price)*i.quantity;
    return {menuItemId:m.id,nameSnapshot:m.name,priceSnapshot:m.price,quantity:i.quantity,notes:i.notes?.slice(0,300),station:m.station};
  });

  const restaurant=await prisma.restaurant.findUniqueOrThrow({where:{id:restaurantId}});
  const tax=Number((subtotal*Number(restaurant.taxRate)/100).toFixed(2));
  const total=Number((subtotal+tax).toFixed(2));

  const order=await prisma.order.create({
    data:{
      restaurantId,sessionId,status:"PAYMENT_PENDING",
      subtotal,tax,total,
      items:{create:normalized},
      payment:{create:{restaurantId,amount:total,status:"CREATED"}}
    },
    include:{items:true,payment:true}
  });

  emitRestaurant(restaurantId,"order:payment_pending",{orderId:order.id,total});
  return order;
}

export async function markOrderPaid(orderId:string,gatewayPaymentId:string){
  const existingPayment=await prisma.payment.findUnique({where:{gatewayPaymentId}});
  if(existingPayment?.status==="PAID") return {duplicate:true};

  const order=await prisma.order.findUnique({where:{id:orderId},include:{items:true}});
  if(!order) throw new Error("Order not found");
  if(order.status==="PAID") return {duplicate:true};

  const stations=[...new Set(order.items.map(i=>i.station))];
  const now=new Date();

  const result=await prisma.$transaction(async tx=>{
    await tx.payment.update({
      where:{orderId},
      data:{status:"PAID",gatewayPaymentId,webhookReceivedAt:now}
    });
    const paid=await tx.order.update({where:{id:orderId},data:{status:"PAID",paidAt:now}});
    for(const station of stations){
      const stationItems=order.items.filter(i=>i.station===station);
      const etaMinutes=Math.max(...stationItems.map(i=>10));
      await tx.kot.create({
        data:{restaurantId:order.restaurantId,orderId,station,state:"QUEUED",
          eta:new Date(now.getTime()+etaMinutes*60000)}
      });
    }
    return paid;
  });

  emitKitchen(order.restaurantId,"kot:new",{orderId,stations});
  emitRestaurant(order.restaurantId,"order:paid",{orderId,total:order.total});
  return result;
}

export async function updateKot(kotId:string,state:"QUEUED"|"IN_PROGRESS"|"READY"|"SERVED"){
  const kot=await prisma.kot.findUniqueOrThrow({where:{id:kotId}});
  const data:any={state};
  if(state==="IN_PROGRESS") data.startedAt=new Date();
  if(state==="READY") data.readyAt=new Date();
  if(state==="SERVED") data.servedAt=new Date();
  const updated=await prisma.kot.update({where:{id:kotId},data});
  emitKitchen(kot.restaurantId,"kot:updated",updated);
  emitRestaurant(kot.restaurantId,"kot:updated",updated);
  return updated;
}
