import {Server} from "socket.io";
let io:Server;
export function initRealtime(server:any){
  io=new Server(server,{cors:{origin:"*",methods:["GET","POST"]}});
  io.on("connection",socket=>{
    socket.on("restaurant:join",(restaurantId:string)=>socket.join(`restaurant:${restaurantId}`));
    socket.on("kitchen:join",(restaurantId:string)=>socket.join(`kitchen:${restaurantId}`));
  });
  return io;
}
export function emitRestaurant(restaurantId:string,event:string,payload:any){
  io?.to(`restaurant:${restaurantId}`).emit(event,payload);
}
export function emitKitchen(restaurantId:string,event:string,payload:any){
  io?.to(`kitchen:${restaurantId}`).emit(event,payload);
}
