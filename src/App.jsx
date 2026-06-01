import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, push, set, remove, update } from "firebase/database";
import html2canvas from "html2canvas";

// ─── Theme ─────────────────────────────────────────────────────────────────────
const COLORS = {
  Priyam:"#FF6B6B",Saloni:"#FF85A1",Devansh:"#5BC0EB",Khushi:"#FFD166",
  Bharat:"#06D6A0",Vansh:"#A78BFA",Chehak:"#F97316",Ashutosh:"#94A3B8",
  Aditi:"#FB923C",Kirtan:"#818CF8",Samarth:"#34D399",Anni:"#F472B6",
};

const CATEGORY_META = {
  badminton:{ icon:"🏸", label:"Badminton",   color:"#5BC0EB" },
  juice:    { icon:"🥤", label:"Juice/Bunta", color:"#FFD166" },
  food:     { icon:"🌯", label:"Food/Rolls",  color:"#FB923C" },
  party:    { icon:"🎉", label:"Party",        color:"#A78BFA" },
  gift:     { icon:"🎂", label:"Gift/Cake",   color:"#FF85A1" },
  payment:  { icon:"✅", label:"Payment",      color:"#06D6A0" },
  misc:     { icon:"📌", label:"Misc",         color:"#94A3B8" },
  penalty:  { icon:"⚠️", label:"Penalty",     color:"#EF4444" },
};
const CATEGORIES = Object.keys(CATEGORY_META);

// balance: debit = they owe me (+), credit = they paid (-), i_owe = I owe them (-)
function getBalance(entries) {
  return Object.values(entries||{}).reduce((sum,e) => {
    if (e.type==="debit")  return sum + e.amount;
    if (e.type==="credit") return sum - e.amount;
    if (e.type==="i_owe")  return sum - e.amount;
    return sum;
  }, 0);
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
}
function nowFilename(name) {
  const n=new Date();
  return `${name.toLowerCase()}_${String(n.getDate()).padStart(2,"0")}${String(n.getMonth()+1).padStart(2,"0")}${n.getFullYear()}_${String(n.getHours()).padStart(2,"0")}${String(n.getMinutes()).padStart(2,"0")}`;
}
function formatINR(n) { return new Intl.NumberFormat("en-IN").format(Math.abs(Math.round(n))); }

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight:"100vh", background:"#080810", color:"#F1EEE9", fontFamily:"'Sora','DM Sans',sans-serif", overflowX:"hidden" },
  input:(accent="#5BC0EB")=>({ width:"100%", background:"#111119", border:`1px solid #2a2a3a`,
    borderRadius:10, padding:"11px 14px", color:"#F1EEE9", fontFamily:"inherit", fontSize:14,
    boxSizing:"border-box", outline:"none", transition:"border-color 0.2s" }),
  label:{ display:"block", fontSize:11, color:"#5a5a7a", marginBottom:6, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600 },
  btn:(bg,color="#080810",full=false)=>({ background:bg, border:"none", borderRadius:10, cursor:"pointer",
    color, fontFamily:"inherit", fontWeight:700, fontSize:14, padding:"11px 18px",
    transition:"all 0.15s", width:full?"100%":undefined }),
  card:(accent="#fff")=>({ background:"#0d0d18", borderRadius:16, border:`1px solid ${accent}18` }),
};

function loadFont() {
  if (document.getElementById("sora-font")) return;
  const l=document.createElement("link"); l.id="sora-font"; l.rel="stylesheet";
  l.href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap";
  document.head.appendChild(l);
}

// ─── Modal (bottom-sheet) ───────────────────────────────────────────────────────
function Modal({title,onClose,children,accent="#5BC0EB"}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)",
      display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999}}
      onClick={onClose}>
      <div style={{background:"#0d0d18",border:`1px solid ${accent}30`,borderRadius:"20px 20px 0 0",
        padding:"0 0 32px",width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto",
        animation:"slideUp 0.25s cubic-bezier(.16,1,.3,1)"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:"center",padding:"12px 0 4px"}}>
          <div style={{width:36,height:4,borderRadius:2,background:"#2a2a3a",margin:"0 auto"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 20px 16px"}}>
          <span style={{fontSize:16,fontWeight:700}}>{title}</span>
          <button onClick={onClose} style={{background:"#1a1a28",border:"1px solid #2a2a3a",borderRadius:8,
            color:"#666",fontSize:18,cursor:"pointer",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"0 20px"}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Input ──────────────────────────────────────────────────────────────────────
function Input({label,value,onChange,type="text",placeholder,min,step,accent="#5BC0EB"}) {
  const [focused,setFocused]=useState(false);
  return (
    <div style={{marginBottom:16}}>
      {label && <label style={S.label}>{label}</label>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} min={min} step={step}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        style={{...S.input(accent), borderColor:focused?accent:"#2a2a3a"}}/>
    </div>
  );
}

// ─── Add Entry Form ─────────────────────────────────────────────────────────────
function AddEntryForm({personName,color,onClose,onSave}) {
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  const [date,setDate]=useState(new Date().toISOString().split("T")[0]);
  const [type,setType]=useState("debit");
  const [cat,setCat]=useState("badminton");
  const [saving,setSaving]=useState(false);

  const save=async()=>{
    if (!desc.trim()||!amount||isNaN(+amount)||+amount<=0) return;
    setSaving(true);
    await onSave({desc:desc.trim(),amount:Math.abs(+amount),date,type,category:cat,createdAt:Date.now()});
    setSaving(false);
    onClose();
  };

  const TYPE_OPTIONS=[
    ["debit",  "➕ They Owe", "#EF4444", "Amount they owe you"],
    ["credit", "✅ They Paid","#06D6A0", "Payment received from them"],
    ["i_owe",  "🔄 I Owe",   "#818CF8", "Amount you owe them"],
  ];

  return (
    <>
      <Input label="Description" value={desc} onChange={setDesc} placeholder="e.g. Badminton PDKP" accent={color}/>
      <Input label="Amount (₹)" value={amount} onChange={setAmount} type="number" placeholder="0" min="0" step="0.5" accent={color}/>
      <Input label="Date" value={date} onChange={setDate} type="date" accent={color}/>

      {/* Type selector */}
      <div style={{marginBottom:16}}>
        <label style={S.label}>Type</label>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {TYPE_OPTIONS.map(([t,label,c,hint])=>(
            <button key={t} onClick={()=>setType(t)} style={{
              padding:"12px 14px",borderRadius:12,cursor:"pointer",fontFamily:"inherit",
              textAlign:"left",transition:"all 0.15s",
              background:type===t?`${c}15`:"#111119",
              border:`1.5px solid ${type===t?c:"#2a2a3a"}`,
            }}>
              <div style={{fontSize:14,fontWeight:700,color:type===t?c:"#5a5a7a"}}>{label}</div>
              <div style={{fontSize:11,color:"#444",marginTop:2}}>{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Category grid */}
      <div style={{marginBottom:20}}>
        <label style={S.label}>Category</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {CATEGORIES.map(c=>{
            const m=CATEGORY_META[c];
            return (
              <button key={c} onClick={()=>setCat(c)} style={{
                padding:"8px 4px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                fontSize:11,fontWeight:600,transition:"all 0.15s",textAlign:"center",
                background:cat===c?`${m.color}22`:"#111119",
                border:`1.5px solid ${cat===c?m.color:"#1e1e2a"}`,
                color:cat===c?m.color:"#444",
              }}>
                <div style={{fontSize:18,marginBottom:2}}>{m.icon}</div>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{
        ...S.btn(color,"#080810",true),padding:"14px",fontSize:15,
        opacity:saving?0.6:1,boxShadow:`0 0 24px ${color}40`,
      }}>
        {saving?"Saving…":"Save Entry"}
      </button>
    </>
  );
}


// ─── Edit Entry Modal ────────────────────────────────────────────────────────────
function EditEntryModal({entry,entryKey,color,onClose,onSave}) {
  const [desc,setDesc]=useState(entry.desc);
  const [amount,setAmount]=useState(String(entry.amount));
  const [date,setDate]=useState(entry.date);
  const [type,setType]=useState(entry.type||"debit");
  const [cat,setCat]=useState(entry.category||"badminton");
  const [saving,setSaving]=useState(false);

  const save=async()=>{
    if (!desc.trim()||!amount||isNaN(+amount)||+amount<=0) return;
    setSaving(true);
    await onSave(entryKey,{...entry,desc:desc.trim(),amount:Math.abs(+amount),date,type,category:cat});
    setSaving(false);
    onClose();
  };

  const TYPE_OPTIONS=[
    ["debit",  "➕ They Owe","#EF4444"],
    ["credit", "✅ They Paid","#06D6A0"],
    ["i_owe",  "🔄 I Owe",  "#818CF8"],
  ];

  return (
    <Modal title="Edit Entry" onClose={onClose} accent={color}>
      <Input label="Description" value={desc} onChange={setDesc} placeholder="e.g. Badminton PDKP" accent={color}/>
      <Input label="Amount (₹)" value={amount} onChange={setAmount} type="number" placeholder="0" min="0" step="0.5" accent={color}/>
      <Input label="Date" value={date} onChange={setDate} type="date" accent={color}/>

      <div style={{marginBottom:16}}>
        <label style={S.label}>Type</label>
        <div style={{display:"flex",gap:8}}>
          {TYPE_OPTIONS.map(([t,label,c])=>(
            <button key={t} onClick={()=>setType(t)} style={{
              flex:1,padding:"10px 6px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",
              fontSize:12,fontWeight:700,transition:"all 0.15s",
              background:type===t?`${c}20`:"#111119",
              border:`1.5px solid ${type===t?c:"#2a2a3a"}`,
              color:type===t?c:"#5a5a7a",
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:20}}>
        <label style={S.label}>Category</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
          {CATEGORIES.map(c=>{
            const m=CATEGORY_META[c];
            return (
              <button key={c} onClick={()=>setCat(c)} style={{
                padding:"8px 4px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                fontSize:11,fontWeight:600,transition:"all 0.15s",textAlign:"center",
                background:cat===c?`${m.color}22`:"#111119",
                border:`1.5px solid ${cat===c?m.color:"#1e1e2a"}`,
                color:cat===c?m.color:"#444",
              }}>
                <div style={{fontSize:18,marginBottom:2}}>{m.icon}</div>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{
        ...S.btn(color,"#080810",true),padding:"14px",fontSize:15,
        opacity:saving?0.6:1,boxShadow:`0 0 24px ${color}40`,
      }}>
        {saving?"Saving…":"✓ Confirm Changes"}
      </button>
    </Modal>
  );
}

// ─── Add Person Form ─────────────────────────────────────────────────────────────
function AddPersonForm({onClose,onSave}) {
  const [name,setName]=useState("");
  const [color,setColor]=useState("#FF6B6B");
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(),color);
    setSaving(false); onClose();
  };
  return (
    <>
      <Input label="Full Name" value={name} onChange={setName} placeholder="e.g. Rahul" accent={color}/>
      <div style={{marginBottom:20}}>
        <label style={S.label}>Pick Color</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["#FF6B6B","#FF85A1","#5BC0EB","#FFD166","#06D6A0","#A78BFA","#F97316","#818CF8","#FB923C","#34D399"].map(c=>(
            <div key={c} onClick={()=>setColor(c)} style={{
              width:36,height:36,borderRadius:"50%",background:c,cursor:"pointer",
              border:`3px solid ${color===c?"#fff":"transparent"}`,
              boxShadow:color===c?`0 0 12px ${c}`:"none",transition:"all 0.15s",
            }}/>
          ))}
          <input type="color" value={color} onChange={e=>setColor(e.target.value)}
            style={{width:36,height:36,borderRadius:"50%",border:"2px dashed #333",cursor:"pointer",padding:2,background:"none"}}/>
        </div>
      </div>
      <div style={{padding:"14px 16px",borderRadius:12,background:`${color}15`,border:`1px solid ${color}40`,marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:17,fontWeight:800,color:"#080810"}}>{(name||"?")[0]?.toUpperCase()}</div>
          <div>
            <div style={{fontWeight:700}}>{name||"New Person"}</div>
            <div style={{fontSize:12,color:"#5a5a7a"}}>Balance: ₹0</div>
          </div>
        </div>
      </div>
      <button onClick={save} disabled={saving} style={{...S.btn(color,"#080810",true),padding:"14px",fontSize:15,boxShadow:`0 0 24px ${color}40`}}>
        {saving?"Adding…":"Add Person"}
      </button>
    </>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────────
function ConfirmModal({title,message,onConfirm,onClose,danger=false,extra=null}) {
  return (
    <Modal title={title} onClose={onClose} accent={danger?"#EF4444":"#5BC0EB"}>
      <p style={{color:"#9090a0",fontSize:14,lineHeight:1.6,marginTop:0,marginBottom:extra?12:20}}>{message}</p>
      {extra}
      <div style={{display:"flex",gap:10,marginTop:extra?16:0}}>
        <button onClick={onClose} style={{...S.btn("#1a1a28"),flex:1,border:"1px solid #2a2a3a",color:"#888"}}>Cancel</button>
        <button onClick={onConfirm} style={{...S.btn(danger?"#EF4444":"#06D6A0"),flex:1}}>Confirm</button>
      </div>
    </Modal>
  );
}

// ─── Person Detail ───────────────────────────────────────────────────────────────
function PersonDetail({name,data,onBack}) {
  const screenshotRef=useRef(null);
  const [showAdd,setShowAdd]=useState(false);
  const [confirm,setConfirm]=useState(null);
  const [editEntry,setEditEntry]=useState(null); // {key, entry}
  const [filterCat,setFilterCat]=useState(null);
  const [tab,setTab]=useState("timeline");

  const color=data.color||COLORS[name]||"#888";
  const entries=data.entries||{};
  const sorted=Object.entries(entries).sort(([,a],[,b])=>new Date(a.date)-new Date(b.date));
  const balance=getBalance(entries);

  const filtered=filterCat?sorted.filter(([,e])=>e.category===filterCat):sorted;

  const totalDebit=sorted.filter(([,e])=>e.type==="debit").reduce((s,[,e])=>s+e.amount,0);
  const totalCredit=sorted.filter(([,e])=>e.type==="credit").reduce((s,[,e])=>s+e.amount,0);
  const totalIOwe=sorted.filter(([,e])=>e.type==="i_owe").reduce((s,[,e])=>s+e.amount,0);

  const catBreakdown=CATEGORIES.map(c=>{
    const ents=sorted.filter(([,e])=>e.category===c&&e.type==="debit");
    return {c,total:ents.reduce((s,[,e])=>s+e.amount,0),count:ents.length};
  }).filter(x=>x.count>0).sort((a,b)=>b.total-a.total);

  const addEntry=async(entry)=>{
    await push(ref(db,`people/${name}/entries`),entry);
  };

  const updateEntry=async(key,updated)=>{
    await update(ref(db,`people/${name}/entries/${key}`),updated);
  };

  const saveImage=async()=>{
    if (!screenshotRef.current) return;
    const el=screenshotRef.current;
    const canvas=await html2canvas(el,{
      backgroundColor:"#080810",scale:2,useCORS:true,
      width:el.scrollWidth,height:el.scrollHeight,
      windowWidth:el.scrollWidth,windowHeight:el.scrollHeight,
    });
    const a=document.createElement("a");
    a.download=`${nowFilename(name)}.jpeg`;
    a.href=canvas.toDataURL("image/jpeg",0.95);
    a.click();
  };

  const doDelete=async()=>{
    if (confirm?.type==="entry") {
      await remove(ref(db,`people/${name}/entries/${confirm.key}`));
    } else if (confirm?.type==="person") {
      await remove(ref(db,`people/${name}`));
      onBack();
    }
    setConfirm(null);
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{background:`linear-gradient(160deg,${color}22 0%,#080810 60%)`,borderBottom:`1px solid ${color}20`,padding:"20px 16px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,maxWidth:540,margin:"0 auto"}}>
          <button onClick={onBack} style={{background:`${color}18`,border:`1px solid ${color}30`,borderRadius:10,
            color,cursor:"pointer",fontSize:18,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div style={{width:46,height:46,borderRadius:"50%",background:color,display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:19,fontWeight:800,color:"#080810"}}>{name[0]}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:20,fontWeight:800}}>{name}</div>
            <div style={{fontSize:12,color:"#5a5a7a"}}>{sorted.length} transactions</div>
          </div>
          <button onClick={saveImage} title="Save as image" style={{background:`${color}18`,border:`1px solid ${color}30`,
            borderRadius:10,color,cursor:"pointer",padding:"8px 12px",fontSize:13,fontWeight:600}}>📸</button>
          <button onClick={()=>setShowAdd(true)} style={{...S.btn(color),padding:"8px 14px",fontSize:13,boxShadow:`0 0 16px ${color}40`}}>+ Add</button>
        </div>
      </div>

      {/* Screenshottable content */}
      <div ref={screenshotRef} style={{background:"#080810",padding:"0 16px 32px",maxWidth:540,margin:"0 auto"}}>

        {/* Balance hero */}
        <div style={{...S.card(color),padding:"20px 22px",marginTop:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-40,right:-40,width:120,height:120,borderRadius:"50%",
            background:color,filter:"blur(60px)",opacity:0.15}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:11,color:"#5a5a7a",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:600}}>
                {balance>0?"Balance Due":balance<0?"You Owe Them":"All Settled"}
              </div>
              <div style={{fontSize:42,fontWeight:800,
                color:balance>0?color:balance<0?"#818CF8":"#06D6A0",
                fontFamily:"'DM Mono',monospace",lineHeight:1.1,marginTop:4}}>
                ₹{formatINR(balance)}
              </div>
              <div style={{fontSize:12,color:"#5a5a7a",marginTop:6}}>
                {balance>0?`${name} owes you`:balance<0?`You owe ${name}`:"🎉 Fully settled!"}
              </div>
            </div>
            <div style={{textAlign:"right",fontSize:12}}>
              <div style={{color:"#5a5a7a",marginBottom:2}}>They Owe</div>
              <div style={{fontWeight:700,color,fontFamily:"'DM Mono',monospace",marginBottom:8}}>₹{formatINR(totalDebit)}</div>
              <div style={{color:"#5a5a7a",marginBottom:2}}>They Paid</div>
              <div style={{fontWeight:700,color:"#06D6A0",fontFamily:"'DM Mono',monospace",marginBottom:8}}>₹{formatINR(totalCredit)}</div>
              {totalIOwe>0&&<>
                <div style={{color:"#5a5a7a",marginBottom:2}}>I Owe</div>
                <div style={{fontWeight:700,color:"#818CF8",fontFamily:"'DM Mono',monospace"}}>₹{formatINR(totalIOwe)}</div>
              </>}
            </div>
          </div>
          {/* Progress bar: they owe vs they paid */}
          {totalDebit>0&&(
            <div style={{marginTop:16}}>
              <div style={{height:6,background:"#1a1a28",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(100,(totalCredit/totalDebit)*100)}%`,
                  background:`linear-gradient(90deg,#06D6A0,${color})`,borderRadius:3,transition:"width 0.5s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                <span style={{fontSize:10,color:"#5a5a7a"}}>Paid {Math.round((totalCredit/totalDebit)*100)}%</span>
                <span style={{fontSize:10,color:"#5a5a7a"}}>Left {Math.round(100-(totalCredit/totalDebit)*100)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,margin:"16px 0",background:"#0d0d18",borderRadius:12,padding:4}}>
          {[["timeline","📋 Timeline"],["stats","📊 Stats"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              flex:1,padding:"9px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",
              fontSize:13,fontWeight:700,transition:"all 0.15s",
              background:tab===t?color:"none",border:"none",
              color:tab===t?"#080810":"#5a5a7a",
            }}>{l}</button>
          ))}
        </div>

        {tab==="timeline"&&(
          <>
            {/* Category chips */}
            {sorted.length>0&&(
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:8,scrollbarWidth:"none"}}>
                <button onClick={()=>setFilterCat(null)} style={{
                  padding:"5px 12px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",
                  fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,
                  background:!filterCat?color:"#111119",border:`1px solid ${!filterCat?color:"#2a2a3a"}`,
                  color:!filterCat?"#080810":"#5a5a7a",
                }}>All</button>
                {catBreakdown.map(({c})=>{
                  const m=CATEGORY_META[c];
                  return (
                    <button key={c} onClick={()=>setFilterCat(filterCat===c?null:c)} style={{
                      padding:"5px 12px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",
                      fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,
                      background:filterCat===c?m.color:"#111119",border:`1px solid ${filterCat===c?m.color:"#2a2a3a"}`,
                      color:filterCat===c?"#080810":"#5a5a7a",
                    }}>{m.icon} {m.label}</button>
                  );
                })}
              </div>
            )}

            {/* Timeline */}
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:19,top:0,bottom:0,width:2,
                background:"linear-gradient(180deg,transparent,#1e1e30 10%,#1e1e30 90%,transparent)",borderRadius:1}}/>
              {filtered.length===0&&<div style={{textAlign:"center",color:"#333",padding:"40px 0",fontSize:14}}>No entries</div>}
              {filtered.map(([key,entry])=>{
                const m=CATEGORY_META[entry.category]||CATEGORY_META.misc;
                const isCredit=entry.type==="credit";
                const isIOwe=entry.type==="i_owe";
                const entryColor=isCredit?"#06D6A0":isIOwe?"#818CF8":m.color;
                const entrySign=isCredit?"−":isIOwe?"−":"+";
                return (
                  <div key={key} style={{display:"flex",gap:10,marginBottom:8,position:"relative",alignItems:"flex-start"}}>
                    <div style={{width:40,height:40,borderRadius:"50%",flexShrink:0,zIndex:1,
                      background:`${entryColor}18`,border:`1.5px solid ${entryColor}40`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,marginTop:2}}>
                      {isIOwe?"🔄":m.icon}
                    </div>
                    <div style={{flex:1,background:"#0d0d18",border:`1px solid ${isCredit||isIOwe?"#1e2a1e":"#1e1e2a"}`,
                      borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:"#D0CCC8",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                          {entry.desc}
                        </div>
                        <div style={{fontSize:11,color:"#444",marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                          {fmtDate(entry.date)}
                          {isIOwe&&<span style={{background:"#818CF820",color:"#818CF8",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700}}>I Owe</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                        <span style={{fontSize:15,fontWeight:800,fontFamily:"'DM Mono',monospace",color:entryColor}}>
                          {entrySign}₹{formatINR(entry.amount)}
                        </span>
                        <button onClick={()=>setEditEntry({key,entry})} style={{
                          background:"none",border:"none",color:"#3a3a5a",cursor:"pointer",
                          fontSize:14,padding:4,lineHeight:1,borderRadius:6,
                        }}
                          onMouseEnter={e=>e.target.style.color=color}
                          onMouseLeave={e=>e.target.style.color="#3a3a5a"}>✏️</button>
                        <button onClick={()=>setConfirm({type:"entry",key})} style={{
                          background:"none",border:"none",color:"#2a2a3a",cursor:"pointer",
                          fontSize:14,padding:4,lineHeight:1,borderRadius:6,
                        }}
                          onMouseEnter={e=>e.target.style.color="#EF4444"}
                          onMouseLeave={e=>e.target.style.color="#2a2a3a"}>🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab==="stats"&&(
          <div>
            <div style={{...S.card(color),padding:"16px 18px",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:"#888",marginBottom:14,letterSpacing:"0.1em",textTransform:"uppercase"}}>
                Spending by Category
              </div>
              {catBreakdown.length===0&&<div style={{color:"#333",fontSize:13}}>No data yet</div>}
              {catBreakdown.map(({c,total,count})=>{
                const m=CATEGORY_META[c];
                const pct=totalDebit>0?(total/totalDebit)*100:0;
                return (
                  <div key={c} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:13,color:"#C0BDB9"}}>{m.icon} {m.label} <span style={{color:"#444",fontSize:11}}>({count})</span></span>
                      <span style={{fontSize:13,fontWeight:700,color:m.color,fontFamily:"'DM Mono',monospace"}}>₹{formatINR(total)}</span>
                    </div>
                    <div style={{height:5,background:"#1a1a28",borderRadius:3}}>
                      <div style={{height:"100%",width:`${pct}%`,background:m.color,borderRadius:3,opacity:0.8}}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                ["They Owe",`₹${formatINR(totalDebit)}`,color,"↑"],
                ["They Paid",`₹${formatINR(totalCredit)}`,"#06D6A0","↓"],
                ["I Owe",`₹${formatINR(totalIOwe)}`,"#818CF8","🔄"],
                ["Net Due",`₹${formatINR(Math.abs(balance))}`,balance>0?color:balance<0?"#818CF8":"#06D6A0",balance>0?"●":balance<0?"↑":"✓"],
              ].map(([label,val,c])=>(
                <div key={label} style={{...S.card(c),padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:"#5a5a7a",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
                  <div style={{fontSize:22,fontWeight:800,color:c,fontFamily:"'DM Mono',monospace"}}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete person */}
        <div style={{marginTop:24,textAlign:"center"}}>
          <button onClick={()=>setConfirm({type:"person"})} style={{
            background:"none",border:"1px solid #EF444420",borderRadius:10,color:"#5a5a7a",
            cursor:"pointer",padding:"9px 20px",fontSize:12,fontFamily:"inherit",transition:"all 0.15s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#EF4444";e.currentTarget.style.color="#EF4444"}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#EF444420";e.currentTarget.style.color="#5a5a7a"}}>
            🗑 Delete {name}
          </button>
        </div>
      </div>{/* end screenshotRef */}

      {/* Floating add */}
      <div style={{position:"fixed",bottom:24,right:20,zIndex:100}}>
        <button onClick={()=>setShowAdd(true)} style={{
          background:color,border:"none",borderRadius:"50%",width:54,height:54,fontSize:24,
          cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:`0 4px 24px ${color}60`,
        }}>+</button>
      </div>

      {showAdd&&(
        <Modal title={`Add Entry — ${name}`} onClose={()=>setShowAdd(false)} accent={color}>
          <AddEntryForm personName={name} color={color} onClose={()=>setShowAdd(false)} onSave={addEntry}/>
        </Modal>
      )}

      {editEntry&&(
        <EditEntryModal
          entry={editEntry.entry}
          entryKey={editEntry.key}
          color={color}
          onClose={()=>setEditEntry(null)}
          onSave={updateEntry}
        />
      )}

      {confirm&&(
        <ConfirmModal
          title={confirm.type==="person"?`Delete ${name}?`:"Delete Entry?"}
          message={confirm.type==="person"
            ?`This will permanently delete ${name} and all their ${sorted.length} entries. This cannot be undone.`
            :"This entry will be permanently deleted."}
          onConfirm={doDelete}
          onClose={()=>setConfirm(null)}
          danger
        />
      )}
    </div>
  );
}

// ─── Person Card ─────────────────────────────────────────────────────────────────
function PersonCard({name,data,onClick}) {
  const color=data.color||COLORS[name]||"#888";
  const balance=getBalance(data.entries||{});
  const entries=Object.values(data.entries||{});
  const entryCount=entries.length;
  const lastEntry=[...entries].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const [hovered,setHovered]=useState(false);
  const totalDebit=entries.filter(e=>e.type==="debit").reduce((s,e)=>s+e.amount,0);
  const totalCredit=entries.filter(e=>e.type==="credit").reduce((s,e)=>s+e.amount,0);
  const pct=totalDebit>0?Math.min(100,(totalCredit/totalDebit)*100):0;

  return (
    <div onClick={onClick} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{background:hovered?`${color}12`:"#0d0d18",borderRadius:16,
        border:`1px solid ${hovered?color+"40":color+"18"}`,padding:"14px 16px",
        cursor:"pointer",transition:"all 0.18s",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,
        borderRadius:"50%",background:color,filter:"blur(40px)",opacity:hovered?0.18:0.06,transition:"opacity 0.2s"}}/>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:46,height:46,borderRadius:"50%",background:color,flexShrink:0,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#080810",
          boxShadow:hovered?`0 0 16px ${color}60`:"0 0 0 transparent",transition:"box-shadow 0.2s"}}>
          {name[0]}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700}}>{name}</div>
          <div style={{fontSize:11,color:"#5a5a7a",marginTop:1}}>
            {entryCount} entries{lastEntry?` · Last: ${fmtDate(lastEntry.date)}`:""}
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:19,fontWeight:800,fontFamily:"'DM Mono',monospace",
            color:balance>0?color:balance<0?"#818CF8":"#06D6A0"}}>
            {balance>0?`₹${formatINR(balance)}`:balance<0?`-₹${formatINR(balance)}`:"✓"}
          </div>
          <div style={{fontSize:10,color:"#5a5a7a",marginTop:1}}>
            {balance>0?"owes you":balance<0?"you owe":"settled"}
          </div>
        </div>
        <span style={{color:"#333",fontSize:18,marginLeft:4}}>›</span>
      </div>
      {totalDebit>0&&(
        <div style={{marginTop:10,height:3,background:"#1a1a28",borderRadius:2}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,#06D6A0,${color})`,borderRadius:2}}/>
        </div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(()=>{loadFont();},[]);

  const [people,setPeople]=useState({});
  const [selected,setSelected]=useState(null);
  const [showAddPerson,setShowAddPerson]=useState(false);
  const [showSeedConfirm,setShowSeedConfirm]=useState(false);
  const [seedStep,setSeedStep]=useState(1); // 1=first confirm, 2=type confirm
  const [seedInput,setSeedInput]=useState("");
  const [seeding,setSeeding]=useState(false);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterTab,setFilterTab]=useState("all");
  const overviewRef=useRef(null);

  useEffect(()=>{
    const r=ref(db,"people");
    const unsub=onValue(r,snap=>{setPeople(snap.val()||{});setLoading(false);});
    return unsub;
  },[]);

  const addPerson=async(name,color)=>{
    await set(ref(db,`people/${name}`),{name,color,entries:{}});
  };

  const openSeed=()=>{setSeedStep(1);setSeedInput("");setShowSeedConfirm(true);};

  const handleSeed=async()=>{
    if (seedInput.trim().toLowerCase()!=="reset") return;
    setSeeding(true);
    const {seedFirebase}=await import("./seedData.js");
    await seedFirebase();
    setSeeding(false);
    setShowSeedConfirm(false);
    setSeedInput("");
  };

  const saveOverview=async()=>{
    if (!overviewRef.current) return;
    // Make a full-page clone to screenshot properly
    const el=overviewRef.current;
    const canvas=await html2canvas(el,{
      backgroundColor:"#080810",scale:2,useCORS:true,
      scrollX:0,scrollY:0,
      width:el.offsetWidth,height:el.scrollHeight,
    });
    const a=document.createElement("a");
    a.download=`hisaab_overview_${nowFilename("all")}.jpeg`;
    a.href=canvas.toDataURL("image/jpeg",0.95);
    a.click();
  };

  if (selected&&people[selected]) {
    return <PersonDetail name={selected} data={people[selected]} onBack={()=>setSelected(null)}/>;
  }

  const allPeople=Object.entries(people).map(([name,data])=>({name,data,balance:getBalance(data.entries||{})}));
  const filtered=allPeople
    .filter(({name})=>name.toLowerCase().includes(search.toLowerCase()))
    .filter(({balance})=>filterTab==="all"?true:filterTab==="owing"?balance>0:balance<=0)
    .sort((a,b)=>b.balance-a.balance);

  const totalOwed=allPeople.reduce((s,p)=>s+Math.max(0,p.balance),0);
  const owingCount=allPeople.filter(p=>p.balance>0).length;
  const settledCount=allPeople.filter(p=>p.balance<=0).length;

  return (
    <div style={S.page}>
      <style>{`
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        ::-webkit-scrollbar{width:0;height:0}
        *{box-sizing:border-box}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      `}</style>

      {/* ── App Banner / Header ─────────────────────────────────────── */}
      <div style={{background:"linear-gradient(160deg,#12122a 0%,#080810 70%)",borderBottom:"1px solid #1a1a2e"}}>
        {/* Banner strip */}
        <div style={{background:"linear-gradient(135deg,#1a1a35,#0d0d1f)",padding:"20px 16px 16px",
          borderBottom:"1px solid #ffffff08",position:"relative",overflow:"hidden"}}>
          {/* Decorative blobs */}
          <div style={{position:"absolute",top:-30,left:-20,width:140,height:140,
            borderRadius:"50%",background:"#818CF8",filter:"blur(70px)",opacity:0.12}}/>
          <div style={{position:"absolute",top:-20,right:40,width:100,height:100,
            borderRadius:"50%",background:"#FF85A1",filter:"blur(60px)",opacity:0.1}}/>
          <div style={{position:"absolute",bottom:-30,right:-20,width:120,height:120,
            borderRadius:"50%",background:"#5BC0EB",filter:"blur(70px)",opacity:0.08}}/>

          <div style={{maxWidth:540,margin:"0 auto",position:"relative",zIndex:1}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                {/* App icon */}
                <div style={{width:52,height:52,borderRadius:14,
                  background:"linear-gradient(135deg,#818CF8,#5BC0EB)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:26,boxShadow:"0 4px 20px #818CF840",flexShrink:0}}>
                  🏸
                </div>
                <div>
                  <div style={{fontSize:11,letterSpacing:"0.2em",color:"#5a5a7a",textTransform:"uppercase",fontWeight:700}}>
                    Hisaab Kitaab
                  </div>
                  <h1 style={{margin:"2px 0 0",fontSize:24,fontWeight:800,
                    background:"linear-gradient(135deg,#F1EEE9 30%,#818CF8)",
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1.2}}>
                    Group Ledger
                  </h1>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>setShowAddPerson(true)} style={{background:"linear-gradient(135deg,#818CF8,#5BC0EB)",border:"none",borderRadius:10,color:"#080810",cursor:"pointer",padding:"9px 14px",fontSize:13,fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap",boxShadow:"0 2px 12px #818CF840"}}>+ Person</button>
                <button onClick={saveOverview} title="Save overview as image" style={{
                  background:"#111119",border:"1px solid #2a2a3a",borderRadius:10,
                  color:"#5a5a7a",cursor:"pointer",width:38,height:38,fontSize:16,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>📸</button>
                <button onClick={openSeed} title="Load seed data (caution!)" style={{
                  background:"#111119",border:"1px solid #2a2a3a",borderRadius:10,
                  color:"#5a5a7a",cursor:"pointer",width:38,height:38,fontSize:15,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>🌱</button>
              </div>
            </div>
          </div>
        </div>

        <div style={{padding:"14px 16px 16px",maxWidth:540,margin:"0 auto"}}>
          {/* Stats */}
          <div ref={overviewRef} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            {[
              ["Total Owed",`₹${formatINR(totalOwed)}`,"#FFD166"],
              ["Owing",owingCount,"#FF85A1"],
              ["Settled",settledCount,"#06D6A0"],
            ].map(([label,val,c])=>(
              <div key={label} style={{background:`${c}12`,borderRadius:12,border:`1px solid ${c}20`,padding:"12px 14px",textAlign:"center"}}>
                <div style={{fontSize:10,color:"#5a5a7a",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:4}}>{label}</div>
                <div style={{fontSize:20,fontWeight:800,color:c,fontFamily:"'DM Mono',monospace"}}>{val}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{position:"relative",marginBottom:12}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#3a3a5a"}}>🔍</span>
            <input placeholder="Search person…" value={search} onChange={e=>setSearch(e.target.value)}
              style={{...S.input(),paddingLeft:40}}/>
          </div>

          {/* Filter tabs */}
          <div style={{display:"flex",gap:4,background:"#0d0d18",borderRadius:12,padding:4}}>
            {[["all","All"],["owing","Owing"],["settled","Settled"]].map(([t,l])=>(
              <button key={t} onClick={()=>setFilterTab(t)} style={{
                flex:1,padding:"8px",borderRadius:9,cursor:"pointer",fontFamily:"inherit",
                fontSize:12,fontWeight:700,transition:"all 0.15s",border:"none",
                background:filterTab===t?"#F1EEE9":"none",
                color:filterTab===t?"#080810":"#5a5a7a",
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* People list */}
      <div style={{padding:"12px 16px 100px",maxWidth:540,margin:"0 auto"}}>
        {loading&&(
          <div style={{textAlign:"center",color:"#333",padding:"60px 0",fontSize:14}}>
            <div style={{fontSize:32,marginBottom:12}}>⏳</div>
            Connecting to Firebase…
          </div>
        )}
        {!loading&&filtered.length===0&&(
          <div style={{textAlign:"center",color:"#333",padding:"60px 0"}}>
            <div style={{fontSize:40,marginBottom:12}}>💸</div>
            <div style={{fontSize:14}}>{search?"No one found":"No people yet — click 🌱 to load data or + to add"}</div>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(({name,data})=>(
            <PersonCard key={name} name={name} data={data} onClick={()=>setSelected(name)}/>
          ))}
        </div>
      </div>

      {/* Floating add */}
      <div style={{position:"fixed",bottom:24,right:20,zIndex:100}}>
        <button onClick={()=>setShowAddPerson(true)} style={{
          background:"linear-gradient(135deg,#818CF8,#5BC0EB)",border:"none",borderRadius:"50%",
          width:56,height:56,fontSize:26,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 4px 24px #818CF880",color:"#080810",fontWeight:800,
        }}>+</button>
      </div>

      {showAddPerson&&(
        <Modal title="Add New Person" onClose={()=>setShowAddPerson(false)}>
          <AddPersonForm onClose={()=>setShowAddPerson(false)} onSave={addPerson}/>
        </Modal>
      )}

      {/* ── Double-confirm seed modal ──────────────────────────────── */}
      {showSeedConfirm&&(
        <Modal title="⚠️ Load Seed Data?" onClose={()=>{setShowSeedConfirm(false);setSeedInput("");}} accent="#EF4444">
          <div style={{background:"#EF444412",border:"1px solid #EF444430",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#EF4444",marginBottom:6}}>This will overwrite ALL data!</div>
            <div style={{fontSize:13,color:"#9090a0",lineHeight:1.6}}>
              Every person and every entry currently in Firebase will be <strong style={{color:"#EF4444"}}>permanently deleted</strong> and replaced with the original March–June seed data.
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <label style={S.label}>Type <span style={{color:"#EF4444",fontFamily:"'DM Mono',monospace",fontSize:13}}>reset</span> to confirm</label>
            <input value={seedInput} onChange={e=>setSeedInput(e.target.value)}
              placeholder="Type reset here…"
              style={{...S.input("#EF4444"),borderColor:seedInput.toLowerCase()==="reset"?"#EF4444":"#2a2a3a"}}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{setShowSeedConfirm(false);setSeedInput("");}}
              style={{...S.btn("#1a1a28"),flex:1,border:"1px solid #2a2a3a",color:"#888"}}>Cancel</button>
            <button onClick={handleSeed}
              disabled={seeding||seedInput.trim().toLowerCase()!=="reset"}
              style={{...S.btn("#EF4444","#fff"),flex:1,
                opacity:(seeding||seedInput.trim().toLowerCase()!=="reset")?0.4:1}}>
              {seeding?"Loading…":"🌱 Yes, Reset"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}