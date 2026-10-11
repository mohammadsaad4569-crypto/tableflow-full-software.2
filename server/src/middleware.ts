import type {NextFunction, Request, Response} from "express";
import {verifyToken} from "./security.js";

export type AuthRequest = Request & {auth?:{userId:string;restaurantId:string|null;role:string}};

export function requireAuth(req:AuthRequest,res:Response,next:NextFunction){
  try{
    const header=req.headers.authorization;
    if(!header?.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
    req.auth=verifyToken(header.slice(7));
    next();
  }catch{return res.status(401).json({error:"Invalid or expired token"});}
}
export function requireRoles(...roles:string[]){
  return (req:AuthRequest,res:Response,next:NextFunction)=>{
    if(!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({error:"Forbidden"});
    next();
  };
}
