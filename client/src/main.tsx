import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {api,API,token} from "./api";
import "./styles.css";
import {io} from "socket.io-client";

type MenuItem={id:string;name:string;description?:string;price:number|string;station:string;isAvailable:boolean;categoryId?:string};
type Category={id:string;name:string;items:MenuItem[]};

function Login({onLogin}:{onLogin:()=>void}){
 const [email,setEmail]=useState("owner@tableflow.demo"),[password,setPassword]=useState("ChangeMe123!"),[err,setErr]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setErr("");try{const d=await api("/auth/login",{method:"POST",body:JSON.stringify({email,password})});localStorage.setItem("tf_token",d.token);onLogin()}catch(e){setErr(e instanceof Error?e.message:"Login failed")}}
 return <div className="login"><form className="card login-card stack" onSubmit={submit}><div className="brand"><div className="mark">T</div><div><h1>TableFlow</h1><span>Restaurant Intelligence Platform</span></div></div><div><h2>Welcome back.</h2><p className="muted">Owner and kitchen access for the operations console.</p></div>{err&&<div className="error">{err}</div>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/><button className="btn">Sign in</button><button type="button" className="btn ghost" onClick={()=>{setEmail("kitchen@tableflow.demo");setPassword("ChangeMe123!")}}>Use kitchen demo</button></form></div>
}

function Owner(){
 const [view,setView]=useState("dashboard"),[data,setData]=useState<any>(null),[kots,setKots]=useState<any[]>([]),[tables,setTables]=useState<any[]>([]),[menu,setMenu]=useState<Category[]>([]),[orders,setOrders]=useState<any[]>([]);
 async function refresh(){try{const [d,k,t,m,o]=await Promise.all([api("/dashboard"),api("/kitchen/kots"),api("/tables"),api("/menu"),api("/orders")]);setData(d);setKots(k.kots);setTables(t.tables);setMenu(m.categories);setOrders(o.orders)}catch(e){console.error(e)}}
 useEffect(()=>{refresh();const s=io(API.replace("/api",""));s.on("connect",()=>{if(data?.restaurantId)s.emit("restaurant:join",data.restaurantId)});s.on("order:paid",refresh);s.on("kot:updated",refresh);return()=>{s.disconnect()}},[]);
 const revenue=data?.revenue??0;
 return <div className="shell"><div className="top"><div className="brand"><div className="mark">T</div><div><h1>TableFlow</h1><span>Restaurant Intelligence Platform</span></div></div><button className="btn ghost" onClick={()=>{localStorage.removeItem("tf_token");location.reload()}}>Sign out</button></div>
 <div className="nav">{["dashboard","kitchen","tables","menu","orders"].map(v=><button className={view===v?"active":""} onClick={()=>setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div>
 {view==="dashboard"&&<><div className="hero"><div className="eyebrow">Owner command center</div><h2>Run the room from one system.</h2><p>Live revenue, tables, kitchen flow and payment state — with the backend as the source of truth.</p></div><div className="grid g4"><Metric label="Revenue" value={`₹${revenue.toLocaleString()}`}/><Metric label="Paid orders" value={data?.orders??0}/><Metric label="AOV" value={`₹${Math.round(data?.aov??0)}`}/><Metric label="Open KOTs" value={data?.openKots??0}/></div><div className="grid g2" style={{marginTop:15}}><div className="card"><h3>Live floor</h3><p className="muted">{data?.activeSessions??0} active sessions across {data?.tables??0} tables.</p><div className="grid g4">{tables.map(t=><div className="card" style={{padding:13}}><b>{t.label}</b><div className="status" style={{marginTop:7}}>QR ACTIVE</div></div>)}</div></div><div className="card"><h3>Recent orders</h3>{orders.slice(0,6).map(o=><div className="row" style={{padding:"10px 0",borderBottom:"1px solid #ffffff09"}}><span>#{o.id.slice(-6)}</span><span>₹{Number(o.total).toFixed(0)}</span><span className="status">{o.status}</span></div>)}</div></div></>}
 {view==="kitchen"&&<Kitchen kots={kots} refresh={refresh}/>}
 {view==="tables"&&<Tables tables={tables} refresh={refresh}/>}
 {view==="menu"&&<MenuAdmin categories={menu} refresh={refresh}/>}
 {view==="orders"&&<div className="card"><h3>Orders</h3><table className="table"><thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>{orders.map(o=><tr><td>#{o.id.slice(-8)}</td><td><span className="status">{o.status}</span></td><td>₹{Number(o.total).toFixed(2)}</td><td>{new Date(o.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
 </div>
}

function Metric({label,value}:{label:string,value:any}){return <div className="card"><div className="metric">{value}</div><div className="metric-label">{label}</div></div>}

function Kitchen({kots,refresh}:{kots:any[],refresh:()=>void}){
 async function move(id:string,state:string){await api(`/kitchen/kots/${id}`,{method:"PATCH",body:JSON.stringify({state})});refresh()}
 return <div><div className="hero"><div className="eyebrow">Kitchen display</div><h2>Make the queue obvious.</h2><p>Tickets are created only after verified payment and routed by preparation station.</p></div><div className="kitchen-grid">{["GRILL","TANDOOR","GRAVY","RICE","BEVERAGES","DESSERT"].map(st=><div className="card"><div className="row"><h3>{st}</h3><span className="status">{kots.filter(k=>k.station===st).length}</span></div>{kots.filter(k=>k.station===st).map(k=><div className="card kot" style={{marginTop:10}}><div className="row"><b>#{k.orderId.slice(-6)}</b><span className="status">{k.state}</span></div><div className="muted" style={{marginTop:8}}>{k.order.items.map((i:any)=>`${i.quantity}× ${i.nameSnapshot}`).join(", ")}</div><div style={{marginTop:12,display:"flex",gap:6}}>{k.state==="QUEUED"&&<button className="btn small" onClick={()=>move(k.id,"IN_PROGRESS")}>Start</button>}{k.state==="IN_PROGRESS"&&<button className="btn small" onClick={()=>move(k.id,"READY")}>Ready</button>}{k.state==="READY"&&<button className="btn small" onClick={()=>move(k.id,"SERVED")}>Served</button>}</div></div>)}</div>)}</div></div>
}

function Tables({tables,refresh}:{tables:any[],refresh:()=>void}){
 const [label,setLabel]=useState("");
 async function add(){if(!label)return;await api("/tables",{method:"POST",body:JSON.stringify({label,seats:4})});setLabel("");refresh()}
 return <div className="grid g2"><div className="card"><div className="eyebrow">Table management</div><h2>QR fleet</h2><p className="muted">Every table gets a signed QR route; the server validates it before creating/reusing a session.</p><div className="row"><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="T09"/><button className="btn" onClick={add}>Add table</button></div></div><div className="card"><h3>Tables</h3>{tables.map(t=><div className="row" style={{padding:"12px 0",borderBottom:"1px solid #ffffff09"}}><div><b>{t.label}</b><div className="muted">{t.seats} seats</div></div><a className="btn small" href={t.qrUrl} target="_blank">Open QR route</a></div>)}</div></div>
}

function MenuAdmin({categories,refresh}:{categories:Category[],refresh:()=>void}){
 const [name,setName]=useState(""),[price,setPrice]=useState(""),[station,setStation]=useState("GRILL");
 async function add(){const cat=categories[0];if(!cat||!name||!price)return;await api("/menu/items",{method:"POST",body:JSON.stringify({categoryId:cat.id,name,price:Number(price),station,basePrepTime:10,isAvailable:true})});setName("");setPrice("");refresh()}
 return <div className="grid g2"><div className="card"><div className="eyebrow">Menu manager</div><h2>Keep availability truthful.</h2><p className="muted">The server filters unavailable items so the customer cannot order a hidden item by manipulating the browser.</p><div className="stack"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Item name"/><input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price in INR"/><input value={station} onChange={e=>setStation(e.target.value)} placeholder="Station"/><button className="btn" onClick={add}>Add menu item</button></div></div><div className="card"><h3>Live menu</h3>{categories.map(c=><div><div className="eyebrow">{c.name}</div>{c.items.map(i=><div className="menu-item"><div><b>{i.name}</b><div className="muted">{i.station} · {i.isAvailable?"Available":"Unavailable"}</div></div><span className="price">₹{Number(i.price).toFixed(0)}</span></div>)}</div>)}</div></div>
}

function Customer(){
 const tokenPath=location.pathname.split("/t/")[1];const [state,setState]=useState<any>(null),[cart,setCart]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{if(tokenPath)fetch(`${API}/public/qr/${tokenPath}`).then(r=>r.json()).then(setState)},[]);
 const items=useMemo(()=>state?.categories?.flatMap((c:Category)=>c.items)||[],[state]);
 const total=items.reduce((s:any,i:MenuItem)=>s+Number(i.price)*(cart[i.id]||0),0);
 async function checkout(){
   setBusy(true);setMsg("");
   try{
    const body={restaurantId:state.restaurant.id,sessionId:state.sessionId,items:Object.entries(cart).filter(([,q])=>q).map(([menuItemId,q])=>({menuItemId,quantity:q}))};
    const d=await fetch(`${API}/public/orders`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
    if(d.error)throw new Error(d.error);
    if(d.gateway.mode==="mock"){
      await fetch(`${API}/payments/mock-confirm`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:d.order.id})});
      setCart({});setMsg("Payment confirmed. Your order is now with the kitchen.");
    }else setMsg(`Gateway order created: ${d.gateway.gatewayOrderId}. Connect Razorpay Checkout to complete payment.`);
   }catch(e){setMsg(e instanceof Error?e.message:"Checkout failed")}finally{setBusy(false)}
 }
 if(!state)return <div className="login"><div className="card login-card"><div className="eyebrow">TableFlow</div><h2>Opening your table…</h2><p className="muted">Validating the signed table QR and loading the live menu.</p></div></div>;
 return <div className="shell"><div className="top"><div className="brand"><div className="mark">T</div><div><h1>{state.restaurant.name}</h1><span>Table {state.table.label} · Digital menu</span></div></div><span className="status">SESSION ACTIVE</span></div><div className="grid g2"><div className="card"><div className="eyebrow">Menu</div>{state.categories.map((c:Category)=><div><h3 style={{marginTop:20}}>{c.name}</h3>{c.items.map(i=><div className="menu-item"><div><b>{i.name}</b><div className="muted">{i.description||i.station}</div></div><div style={{textAlign:"right"}}><div className="price">₹{Number(i.price).toFixed(0)}</div><button className="btn small" onClick={()=>setCart(x=>({...x,[i.id]:(x[i.id]||0)+1}))}>Add</button></div></div>)}</div>)}</div><div className="card cart"><div className="eyebrow">Your table</div><h3>Order summary</h3>{items.filter(i=>cart[i.id]).map(i=><div className="row" style={{padding:"9px 0"}}><span>{i.name} × {cart[i.id]}</span><b>₹{(Number(i.price)*cart[i.id]).toFixed(0)}</b></div>)}<hr style={{borderColor:"#ffffff10"}}/><div className="row"><b>Total before tax</b><b>₹{total.toFixed(2)}</b></div><button className="btn" disabled={!total||busy} style={{width:"100%",marginTop:14}} onClick={checkout}>{busy?"Processing…":"Pay & place order"}</button>{msg&&<div className="status" style={{marginTop:12,display:"block",lineHeight:1.5}}>{msg}</div>}</div></div></div>
}

function App(){
 const [logged,setLogged]=useState(!!token());
 if(location.pathname.startsWith("/t/")) return <Customer/>;
 if(!logged)return <Login onLogin={()=>setLogged(true)}/>;
 return <Owner/>;
}
createRoot(document.getElementById("root")!).render(<App/>);
