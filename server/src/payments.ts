import Razorpay from "razorpay";
import {env} from "./config.js";
import {prisma} from "./db.js";

const razorpay = env.PAYMENT_MODE==="razorpay" && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
  ? new Razorpay({key_id:env.RAZORPAY_KEY_ID,key_secret:env.RAZORPAY_KEY_SECRET})
  : null;

export async function createGatewayOrder(orderId:string,amount:number){
  if(env.PAYMENT_MODE==="mock"){
    const gatewayOrderId=`mock_order_${orderId}`;
    await prisma.payment.update({where:{orderId},data:{gatewayOrderId,status:"PENDING"}});
    return {mode:"mock",gatewayOrderId,keyId:"mock",amount};
  }
  if(!razorpay) throw new Error("Razorpay is not configured");
  const gatewayOrder=await razorpay.orders.create({amount:Math.round(amount*100),currency:"INR",receipt:orderId});
  await prisma.payment.update({where:{orderId},data:{gatewayOrderId:gatewayOrder.id,status:"PENDING"}});
  return {mode:"razorpay",gatewayOrderId:gatewayOrder.id,keyId:env.RAZORPAY_KEY_ID,amount};
}

export async function reconcilePendingPayments(){
  // Production adapter point: query Razorpay order/payment status here.
  // Mock mode auto-confirms nothing; this deliberately keeps the server webhook as the source of truth.
  if(env.PAYMENT_MODE==="mock") return;
  // eslint-disable-next-line no-console
  console.log("Payment reconciliation tick");
}
