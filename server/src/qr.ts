import QRCode from "qrcode";
import {env} from "./config.js";
import {signQrPayload} from "./security.js";

export function makeQrToken(restaurantId:string,tableId:string,issuedAt=Date.now()){
  return signQrPayload({restaurantId,tableId,issuedAt},env.QR_SECRET);
}
export function makeQrUrl(restaurantId:string,tableId:string){
  return `${env.APP_URL}/t/${makeQrToken(restaurantId,tableId)}`;
}
export async function makeQrDataUrl(restaurantId:string,tableId:string){
  return QRCode.toDataURL(makeQrUrl(restaurantId,tableId),{margin:2,width:640});
}
