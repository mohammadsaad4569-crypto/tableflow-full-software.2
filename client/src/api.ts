const API=import.meta.env.VITE_API_URL||"/api";
export function token(){return localStorage.getItem("tf_token")||""}
export async function api(path:string,options:RequestInit={}){
  const headers=new Headers(options.headers);
  headers.set("Content-Type","application/json");
  const t=token(); if(t) headers.set("Authorization",`Bearer ${t}`);
  const r=await fetch(`${API}${path}`,{...options,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||"Request failed");
  return data;
}
export {API};
