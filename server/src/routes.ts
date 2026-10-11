import {Router} from "express";
import {z} from "zod";
import {prisma} from "./db.js";
import {hashPassword,verifyPassword,signToken,verifyQrPayload,verifyRazorpaySignature} from "./security.js";
import {requireAuth,requireRoles,AuthRequest} from "./middleware.js";
import {makeQrDataUrl,makeQrUrl} from "./qr.js";
import {env} from "./config.js";
import {createGatewayOrder, reconcilePendingPayments} from "./payments.js";
import {recalcAndCreatePayment,markOrderPaid,updateKot} from "./orderService.js";
import {emitKitchen} from "./realtime.js";

export const router=Router();

router.get("/health",(_,res)=>res.json({ok:true,service:"tableflow-api",time:new Date().toISOString()}));

router.post("/auth/login",async(req,res)=>{
  const body=z.object({email:z.string().email(),password:z.string().min(1)}).parse(req.body);
  const user=await prisma.user.findUnique({where:{email:body.email}});
  if(!user || user.status!=="ACTIVE" || !(await verifyPassword(body.password,user.passwordHash)))
    return res.status(401).json({error:"Invalid credentials"});
  const token=signToken({userId:user.id,restaurantId:user.restaurantId,role:user.role});
  res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role,restaurantId:user.restaurantId}});
});

router.post("/onboarding/restaurant",async(req,res)=>{
  const body=z.object({
    name:z.string().min(2),email:z.string().email(),password:z.string().min(8),
    address:z.string().optional(),gstNumber:z.string().optional()
  }).parse(req.body);
  const exists=await prisma.user.findUnique({where:{email:body.email}});
  if(exists) return res.status(409).json({error:"Email already registered"});
  const slug=body.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")+"-"+Date.now().toString(36);
  const passwordHash=await hashPassword(body.password);
  const result=await prisma.$transaction(async tx=>{
    const restaurant=await tx.restaurant.create({data:{name:body.name,slug,address:body.address,gstNumber:body.gstNumber}});
    const user=await tx.user.create({data:{restaurantId:restaurant.id,name:"Owner",email:body.email,passwordHash,role:"OWNER"}});
    return {restaurant,user};
  });
  res.status(201).json({restaurant:result.restaurant,user:{id:result.user.id,email:result.user.email}});
});

router.get("/public/qr/:token",async(req,res)=>{
  try{
    const payload=verifyQrPayload(req.params.token,env.QR_SECRET);
    const table=await prisma.restaurantTable.findFirst({where:{id:payload.tableId,restaurantId:payload.restaurantId,active:true},include:{restaurant:true}});
    if(!table) return res.status(404).json({error:"Table not found"});
    let session=await prisma.session.findFirst({where:{tableId:table.id,status:"ACTIVE",expiresAt:{gt:new Date()}}});
    if(!session){
      session=await prisma.session.create({data:{restaurantId:table.restaurantId,tableId:table.id,expiresAt:new Date(Date.now()+3*60*60*1000)}});
    }else{
      session=await prisma.session.update({where:{id:session.id},data:{lastActivity:new Date(),expiresAt:new Date(Date.now()+3*60*60*1000)}});
    }
    const categories=await prisma.menuCategory.findMany({where:{restaurantId:table.restaurantId},orderBy:{sortOrder:"asc"},include:{items:{where:{isAvailable:true},orderBy:{name:"asc"}}}});
    res.json({restaurant:{id:table.restaurant.id,name:table.restaurant.name,taxRate:table.restaurant.taxRate},table:{id:table.id,label:table.label},sessionId:session.id,categories});
  }catch(e){res.status(403).json({error:"Invalid QR"});}
});

router.post("/public/orders",async(req,res)=>{
  try{
    const body=z.object({restaurantId:z.string(),sessionId:z.string(),items:z.array(z.object({menuItemId:z.string(),quantity:z.number().int().positive(),notes:z.string().optional()}))}).parse(req.body);
    const order=await recalcAndCreatePayment(body.restaurantId,body.sessionId,body.items);
    const gateway=await createGatewayOrder(order.id,Number(order.total));
    res.status(201).json({order:{id:order.id,status:order.status,subtotal:order.subtotal,tax:order.tax,total:order.total},gateway});
  }catch(e){res.status(400).json({error:e instanceof Error?e.message:"Could not create order"});}
});

router.post("/payments/mock-confirm",async(req,res)=>{
  if(env.PAYMENT_MODE!=="mock") return res.status(404).end();
  const body=z.object({orderId:z.string()}).parse(req.body);
  const result=await markOrderPaid(body.orderId,`mock_payment_${body.orderId}`);
  res.json(result);
});

router.post("/payments/razorpay/webhook",async(req,res)=>{
  if(env.PAYMENT_MODE!=="razorpay") return res.status(404).end();
  const signature=String(req.headers["x-razorpay-signature"]||"");
  const raw=(req as any).rawBody as string|undefined;
  if(!raw || !verifyRazorpaySignature(raw,signature)) return res.status(401).json({error:"Invalid signature"});
  const event=req.body;
  if(event.event==="payment.captured"){
    const payment=event.payload?.payment?.entity;
    const orderId=payment?.notes?.orderId || payment?.order_id && undefined;
    if(orderId) await markOrderPaid(orderId,payment.id);
  }
  res.json({received:true});
});

router.use(requireAuth);

router.get("/me",async(req:AuthRequest,res)=>{
  const user=await prisma.user.findUniqueOrThrow({where:{id:req.auth!.userId},include:{restaurant:true}});
  res.json({user});
});

router.get("/dashboard",requireRoles("OWNER","MANAGER","SUPER_ADMIN"),async(req:AuthRequest,res)=>{
  const restaurantId=req.auth!.restaurantId!;
  const paid=await prisma.order.aggregate({where:{restaurantId,status:"PAID"},_sum:{total:true},_count:{_all:true},_avg:{total:true}});
  const kots=await prisma.kot.count({where:{restaurantId,state:{in:["QUEUED","IN_PROGRESS"]}}});
  const tables=await prisma.restaurantTable.count({where:{restaurantId,active:true}});
  const activeSessions=await prisma.session.count({where:{restaurantId,status:"ACTIVE",expiresAt:{gt:new Date()}}});
  res.json({revenue:Number(paid._sum.total||0),orders:paid._count._all,aov:Number(paid._avg.total||0),openKots:kots,tables,activeSessions});
});

router.get("/tables",requireRoles("OWNER","MANAGER","WAITER"),async(req:AuthRequest,res)=>{
  const tables=await prisma.restaurantTable.findMany({where:{restaurantId:req.auth!.restaurantId!},orderBy:{label:"asc"}});
  res.json({tables:await Promise.all(tables.map(async t=>({...t,qrUrl:makeQrUrl(t.restaurantId,t.id)})))});
});

router.post("/tables",requireRoles("OWNER","MANAGER"),async(req:AuthRequest,res)=>{
  const body=z.object({label:z.string().min(1).max(20),seats:z.number().int().positive().max(30).default(4)}).parse(req.body);
  const table=await prisma.restaurantTable.create({data:{restaurantId:req.auth!.restaurantId!,label:body.label,seats:body.seats,qrSecret:env.QR_SECRET}});
  res.status(201).json({...table,qrUrl:makeQrUrl(table.restaurantId,table.id),qrDataUrl:await makeQrDataUrl(table.restaurantId,table.id)});
});

router.get("/menu",requireRoles("OWNER","MANAGER","WAITER","KITCHEN"),async(req:AuthRequest,res)=>{
  const categories=await prisma.menuCategory.findMany({where:{restaurantId:req.auth!.restaurantId!},orderBy:{sortOrder:"asc"},include:{items:{orderBy:{name:"asc"}}}});
  res.json({categories});
});

router.post("/menu/categories",requireRoles("OWNER","MANAGER"),async(req:AuthRequest,res)=>{
  const body=z.object({name:z.string().min(1).max(60),sortOrder:z.number().int().default(0)}).parse(req.body);
  res.status(201).json(await prisma.menuCategory.create({data:{restaurantId:req.auth!.restaurantId!,...body}}));
});

router.post("/menu/items",requireRoles("OWNER","MANAGER"),async(req:AuthRequest,res)=>{
  const body=z.object({categoryId:z.string().optional(),name:z.string().min(1),description:z.string().optional(),price:z.number().positive(),station:z.string().min(1),basePrepTime:z.number().int().positive().default(10),isAvailable:z.boolean().default(true),imageUrl:z.string().url().optional()}).parse(req.body);
  const item=await prisma.menuItem.create({data:{restaurantId:req.auth!.restaurantId!,...body}});
  res.status(201).json(item);
});

router.patch("/menu/items/:id",requireRoles("OWNER","MANAGER"),async(req:AuthRequest,res)=>{
  const body=z.object({name:z.string().optional(),description:z.string().optional(),price:z.number().positive().optional(),station:z.string().optional(),basePrepTime:z.number().int().positive().optional(),isAvailable:z.boolean().optional(),imageUrl:z.string().url().nullable().optional()}).parse(req.body);
  const item=await prisma.menuItem.updateMany({where:{id:req.params.id,restaurantId:req.auth!.restaurantId!},data:body});
  if(!item.count) return res.status(404).json({error:"Item not found"});
  res.json({ok:true});
});

router.get("/kitchen/kots",requireRoles("OWNER","MANAGER","KITCHEN"),async(req:AuthRequest,res)=>{
  const kots=await prisma.kot.findMany({where:{restaurantId:req.auth!.restaurantId!,state:{in:["QUEUED","IN_PROGRESS","READY"]}},orderBy:[{priority:"desc"},{createdAt:"asc"}],include:{order:{include:{items:true}}}});
  res.json({kots});
});

router.patch("/kitchen/kots/:id",requireRoles("OWNER","MANAGER","KITCHEN"),async(req:AuthRequest,res)=>{
  const state=z.enum(["QUEUED","IN_PROGRESS","READY","SERVED"]).parse(req.body.state);
  const kot=await prisma.kot.findFirst({where:{id:req.params.id,restaurantId:req.auth!.restaurantId!}});
  if(!kot) return res.status(404).json({error:"KOT not found"});
  res.json(await updateKot(kot.id,state));
});

router.get("/orders",requireRoles("OWNER","MANAGER","CASHIER","WAITER"),async(req:AuthRequest,res)=>{
  const orders=await prisma.order.findMany({where:{restaurantId:req.auth!.restaurantId!},orderBy:{createdAt:"desc"},take:100,include:{items:true,payment:true}});
  res.json({orders});
});

router.get("/audit",requireRoles("OWNER","MANAGER"),async(req:AuthRequest,res)=>{
  res.json({logs:await prisma.auditLog.findMany({where:{restaurantId:req.auth!.restaurantId!},orderBy:{createdAt:"desc"},take:100})});
});

router.post("/admin/reconcile",requireRoles("OWNER","MANAGER","SUPER_ADMIN"),async(_,res)=>{
  await reconcilePendingPayments();
  res.json({ok:true});
});

router.get("/qr/:tableId",requireRoles("OWNER","MANAGER"),async(req:AuthRequest,res)=>{
  const table=await prisma.restaurantTable.findFirst({where:{id:req.params.tableId,restaurantId:req.auth!.restaurantId!}});
  if(!table) return res.status(404).json({error:"Table not found"});
  res.json({url:makeQrUrl(table.restaurantId,table.id),dataUrl:await makeQrDataUrl(table.restaurantId,table.id)});
});
