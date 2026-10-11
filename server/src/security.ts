import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "./config.js";

export async function hashPassword(password:string){
  return bcrypt.hash(password, 12);
}
export async function verifyPassword(password:string, hash:string){
  return bcrypt.compare(password, hash);
}
export function signToken(payload:{userId:string; restaurantId:string|null; role:string}){
  return jwt.sign(payload, env.JWT_SECRET, {expiresIn:"12h"});
}
export function verifyToken(token:string){
  return jwt.verify(token, env.JWT_SECRET) as {userId:string;restaurantId:string|null;role:string};
}
function deriveQrSecret(restaurantId:string, secret:string){
  return crypto.createHmac("sha256",secret).update(`restaurant:${restaurantId}`).digest("hex");
}
export function signQrPayload(payload:{restaurantId:string;tableId:string;issuedAt:number}, secret:string){
  const raw=Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig=crypto.createHmac("sha256",deriveQrSecret(payload.restaurantId,secret)).update(raw).digest("base64url");
  return `${raw}.${sig}`;
}
export function verifyQrPayload(token:string, secret:string){
  const [raw,sig]=token.split(".");
  if(!raw||!sig) throw new Error("Invalid QR");
  let payload:{restaurantId:string;tableId:string;issuedAt:number};
  try{ payload=JSON.parse(Buffer.from(raw,"base64url").toString("utf8")); }catch{ throw new Error("Invalid QR"); }
  const expected=crypto.createHmac("sha256",deriveQrSecret(payload.restaurantId,secret)).update(raw).digest("base64url");
  if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) throw new Error("Invalid QR signature");
  return payload;
}
export function verifyRazorpaySignature(rawBody:string, signature:string){
  return crypto.createHmac("sha256",env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex")===signature;
}
