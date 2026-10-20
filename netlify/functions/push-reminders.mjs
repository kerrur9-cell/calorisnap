import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { sendWebPush } from "../../src/lib/push/web-push.ts";
import { makeLovingMessage } from "../../src/lib/push/message.ts";
export const config = { schedule: "*/15 * * * *" };
export function localClock(timezone, now = new Date()) {
 const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(({type,value})=>[type,value]));
 return {date: `${p.year}-${p.month}-${p.day}`, minutes:Number(p.hour)*60+Number(p.minute)};
}
export function bonusEnabled(userId,date) { return createHash("sha256").update(`${userId}:${date}:bonus`).digest()[0]<128; }
export function deliveryState(row) {
 try { const s=JSON.parse(row.last_message||"null"); if(s && typeof s.date==="string" && Array.isArray(s.slots) && Array.isArray(s.history)) return s; } catch {}
 return {date:"",slots:[],history:row.last_message?[row.last_message]:[]};
}
export function dueSlot(row,now) {
 try {
  if(!row.enabled) return null;
  const local=localClock(row.timezone,now), s=deliveryState(row);
  return [660,900,1140,...(bonusEnabled(row.user_id,local.date)?[1230]:[])].find(t=>local.minutes>=t && local.minutes<t+120 && !(s.date===local.date && s.slots.includes(t)))??null;
 } catch { return null; }
}
export function isDue(row,now) { return dueSlot(row,now)!==null; }
export default async function handler() {
 try {
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.VAPID_PRIVATE_KEY) throw new Error("Push environment incomplete");
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const now=new Date(),due=[];
  for(let offset=0;;offset+=500) {
   const {data,error}=await db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,timezone,last_message,enabled,updated_at,last_sent_date").eq("enabled",true).order("id").range(offset,offset+499);
   if(error) throw new Error("Could not load subscriptions");
   for(const row of data||[]) if(isDue(row,now)) due.push(row);
   if(!data||data.length<500) break;
  }
  const results=await Promise.allSettled(due.slice(0,10).map(async row=>{
   const slot=dueSlot(row,now),date=localClock(row.timezone,now).date,old=deliveryState(row);
   const state={date,slots:[...(old.date===date?old.slots:[]),slot],history:old.history.slice(-12)};
   const stamp=new Date().toISOString();
   const {data:claim,error}=await db.from("push_subscriptions").update({last_message:JSON.stringify(state),last_sent_date:date,updated_at:stamp}).eq("id",row.id).eq("updated_at",row.updated_at).select("id");
   if(error) throw new Error("Could not claim reminder");
   if(!claim?.length) return "skipped";
   try {
    const {text}=await makeLovingMessage(state.history,`Доброе напоминание о еде и дневнике в ${Math.floor(slot/60)}:${String(slot%60).padStart(2,"0")}`);
    const result=await sendWebPush(row.endpoint,row,{title:"Для Дашули 💚",body:text,url:"/day",tag:`meal-${date}-${slot}`,actions:[{action:"log",title:"Записать еду",url:"/foods"},{action:"photo",title:"Сфоткать",url:"/camera"}]});
    if(result==="expired") { await db.from("push_subscriptions").delete().eq("id",row.id); return "expired"; }
    state.history=[...state.history,text].slice(-12);
    const {error:historyError}=await db.from("push_subscriptions").update({last_message:JSON.stringify(state)}).eq("id",row.id).eq("updated_at",stamp);
    if(historyError) console.warn("Could not record reminder history");
    return "sent";
   } catch(error) {
    await db.from("push_subscriptions").update({last_message:row.last_message,last_sent_date:row.last_sent_date,updated_at:new Date().toISOString()}).eq("id",row.id).eq("updated_at",stamp);
    throw error;
   }
  }));
  const sent=results.filter(r=>r.status==="fulfilled"&&r.value==="sent").length,failed=results.filter(r=>r.status==="rejected").length;
  console.info("Push reminders",{due:due.length,sent,failed});
  return Response.json({ok:true,due:due.length,sent,failed});
 } catch(error) { console.error("Push failed",error instanceof Error?error.message:"unknown"); return Response.json({ok:false},{status:500}); }
}
