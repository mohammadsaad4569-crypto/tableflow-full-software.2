import express from "express";
import http from "node:http";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {env} from "./config.js";
import {router} from "./routes.js";
import {initRealtime} from "./realtime.js";
import cron from "node-cron";
import {reconcilePendingPayments} from "./payments.js";

const app=express();
const server=http.createServer(app);
const __dirname=path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin:env.CORS_ORIGIN,credentials:false}));
app.use(express.json({
  limit:"1mb",
  verify:(req:any,_res,buf)=>{req.rawBody=buf.toString("utf8");}
}));
app.use("/api",router);

const clientDist=path.resolve(__dirname,"../../client/dist");
app.use(express.static(clientDist));
app.get("/{*splat}",(req,res)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({error:"Not found"});
  res.sendFile(path.join(clientDist,"index.html"));
});

initRealtime(server);
cron.schedule("*/3 * * * *",()=>reconcilePendingPayments().catch(console.error));

server.listen(env.PORT,()=>console.log(`TableFlow API listening on ${env.PORT}`));
