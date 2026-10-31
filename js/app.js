
// ══════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════
const DAYS=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
const DAY_S=['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
const MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TYPE_META={
  class:{label:'เรียน',color:'#3D5A80',soft:'#E8EEF5'},
  work:{label:'งาน/พาร์ทไทม์',color:'#C8553D',soft:'#FBEAE5'}
};
const EV_META={
  exam:{label:'สอบ',color:'#B5451B',bg:'#FDECEA'},
  holiday:{label:'วันหยุด',color:'#2E7D56',bg:'#E8F5EE'},
  deadline:{label:'ส่งงาน',color:'#7B4FCA',bg:'#F2EDFB'},
  activity:{label:'กิจกรรม',color:'#C07D1A',bg:'#FDF3E3'}
};
const HOUR_W=56, DAY_START=6*60, DAY_END=22*60;
const DEMO={email:'kong@student.ac.th',password:'P@ssw0rd123',name:'Kong'};

// ══════════════════════════════════════════════════════════════
//  JWT SIMULATION (ใน production ส่งไปที่ /auth/login จริงๆ)
// ══════════════════════════════════════════════════════════════
// สร้าง JWT จำลอง (ตัวอย่าง — production ใช้ backend จริง)
function b64url(obj){return btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function makeJWT(payload){
  const header={alg:'HS256',typ:'JWT'};
  const p={...payload,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+604800};
  // signature จำลอง (production ต้องทำบน backend ด้วย jsonwebtoken)
  const sig=btoa('HMAC-SHA256-SIMULATED-'+payload.email).replace(/=/g,'');
  return `${b64url(header)}.${b64url(p)}.${sig}`;
}
function parseJWT(token){
  try{const[,p]=token.split('.');return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));}
  catch{return null;}
}
function isTokenValid(token){
  const p=parseJWT(token);
  return p&&p.exp*1000>Date.now();
}

// ══════════════════════════════════════════════════════════════
//  LOCAL DATA STORE (แทน backend จริงในตัวอย่างนี้)
// ══════════════════════════════════════════════════════════════
const DEF_ITEMS=[
  {id:'i1',type:'class',name:'คณิตศาสตร์',day:0,start:'09:00',end:'10:30'},
  {id:'i2',type:'class',name:'ฟิสิกส์',day:2,start:'13:00',end:'15:00'},
  {id:'i3',type:'work',name:'พาร์ทไทม์กาแฟ',day:4,start:'17:00',end:'21:00'},
  {id:'i4',type:'work',name:'พาร์ทไทม์กาแฟ',day:5,start:'10:00',end:'16:00'},
];
const DEF_EVS=[
  {id:'e1',date:'2026-07-15',type:'deadline',name:'ส่งรายงานฟิสิกส์'},
  {id:'e2',date:'2026-08-12',type:'holiday',name:'วันแม่แห่งชาติ'},
  {id:'e3',date:'2026-10-01',type:'exam',name:'สอบปลายภาค'},
];

function ls(k,def){try{const v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch{return def;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

let currentUser=null;
let items=[], events=[], restTarget=2, notifyOn=false;
let selDay=jsDayToOur(new Date().getDay());
let yearView=new Date().getFullYear(), selMonth=new Date().getMonth(), selDate=null;
let currentType='class';
let notifyInterval=null;
const notified=new Set();
let idSeed=Date.now();

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
const users_db_key='jwtdemo_users';
function getUsers(){return ls(users_db_key,{});}
function saveUsers(u){lsSet(users_db_key,u);}

function switchTab(t){
  document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',i===(t==='login'?0:1)));
  document.getElementById('form-login').style.display=t==='login'?'':'none';
  document.getElementById('form-register').style.display=t==='register'?'':'none';
}
function fillDemo(){
  document.getElementById('l-email').value=DEMO.email;
  document.getElementById('l-password').value=DEMO.password;
  // auto register demo if needed
  const users=getUsers();
  if(!users[DEMO.email]){
    users[DEMO.email]={passwordHash:btoa(DEMO.password),name:DEMO.name,id:'demo-001'};
    saveUsers(users);
  }
  setMsg('l-msg','✓ กรอกบัญชีทดสอบให้แล้ว กด "เข้าสู่ระบบ"','ok');
}
function checkPw(v){
  let s=0,label='';
  if(v.length>=8)s++;if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
  const colors=['#EDE7D9','#C8553D','#C07D1A','#3D5A80','#2E7D56'];
  const labels=['','อ่อน','พอใช้','ดี','แข็งแกร่ง'];
  document.getElementById('pw-fill').style.width=(s*25)+'%';
  document.getElementById('pw-fill').style.background=colors[s];
  document.getElementById('pw-strength-label').textContent=labels[s]?`(${labels[s]})`:'';
}
function setMsg(id,msg,type='err'){
  const el=document.getElementById(id);
  el.className=type==='ok'?'ok-msg':'err-msg';
  el.textContent=msg;
}
function doRegister(){
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim().toLowerCase();
  const pw=document.getElementById('r-password').value;
  if(!name)return setMsg('r-msg','กรอกชื่อด้วยนะ');
  if(!email||!/\S+@\S+\.\S+/.test(email))return setMsg('r-msg','อีเมลไม่ถูกต้อง');
  if(pw.length<8)return setMsg('r-msg','รหัสผ่านต้องมีอย่างน้อย 8 ตัว');
  const users=getUsers();
  if(users[email])return setMsg('r-msg','อีเมลนี้ถูกใช้แล้ว');
  const uid='u'+Date.now();
  // จำลอง bcrypt hash (production ใช้ bcrypt จริงบน backend)
  users[email]={passwordHash:btoa(pw),name,id:uid};
  saveUsers(users);
  setMsg('r-msg','✓ สมัครสำเร็จ! กำลังเข้าสู่ระบบ...','ok');
  setTimeout(()=>loginUser(uid,email,name),700);
}
function doLogin(){
  const email=document.getElementById('l-email').value.trim().toLowerCase();
  const pw=document.getElementById('l-password').value;
  if(!email||!pw)return setMsg('l-msg','กรอกข้อมูลให้ครบ');
  const users=getUsers();
  const u=users[email];
  if(!u||atob(u.passwordHash)!==pw)return setMsg('l-msg','อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  loginUser(u.id,email,u.name);
}
function loginUser(uid,email,name){
  // จำลองการส่ง POST /auth/login และรับ token
  const token=makeJWT({id:uid,email,name});
  localStorage.setItem('jwt_token',token);
  localStorage.setItem('jwt_user',JSON.stringify({id:uid,email,name}));
  loadApp(uid,email,name);
}
function doLogout(){
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('jwt_user');
  currentUser=null;
  clearInterval(notifyInterval);
  document.getElementById('auth-wrap').style.display='flex';
  document.getElementById('app').style.display='none';
}
function autoLogin(){
  const token=localStorage.getItem('jwt_token');
  const user=ls('jwt_user',null);
  if(token&&user&&isTokenValid(token)){
    loadApp(user.id,user.email,user.name);
    return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
//  APP INIT
// ══════════════════════════════════════════════════════════════
function loadApp(uid,email,name){
  currentUser={uid,email,name};
  document.getElementById('auth-wrap').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('user-label').textContent=`${name||email} · JWT authenticated`;

  // โหลดข้อมูลจาก localStorage (key แยกต่อ user)
  items=ls(`items_${uid}`,DEF_ITEMS);
  events=ls(`events_${uid}`,DEF_EVS);
  restTarget=ls(`rest_${uid}`,2);

  buildDayPills();
  renderSchedule();
  renderYearly();
  renderSummary();
  showToken();
}

// ══════════════════════════════════════════════════════════════
//  CALC HELPERS
// ══════════════════════════════════════════════════════════════
function toMin(t){const[h,m]=t.split(':').map(Number);return h*60+m;}
function toLabel(m){return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
function jsDayToOur(d){return d===0?6:d-1;}
function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function firstDayOfMonth(y,m){const d=new Date(y,m,1).getDay();return d===0?6:d-1;}

function calcFreeByDay(){
  return Array.from({length:7},(_,d)=>{
    const busy=items.filter(i=>i.day===d).map(i=>[toMin(i.start),toMin(i.end)]).sort((a,b)=>a[0]-b[0]);
    const merged=[];
    for(const[s,e]of busy){if(merged.length&&s<=merged[merged.length-1][1])merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],e);else merged.push([s,e]);}
    let cur=DAY_START;const free=[];
    for(const[s,e]of merged){if(s>cur)free.push([cur,s]);cur=Math.max(cur,e);}
    if(cur<DAY_END)free.push([cur,DAY_END]);
    return free.filter(([s,e])=>e-s>=30);
  });
}
function calcRestByDay(freeByDay){
  const tgt=restTarget*60;
  return freeByDay.map((free,d)=>{
    const busy=items.filter(i=>i.day===d).map(i=>[toMin(i.start),toMin(i.end)]).sort((a,b)=>a[0]-b[0]);
    const sc=free.map(([s,e])=>({s,e,len:e-s,al:!!busy.find(b=>b[1]===s&&b[1]-b[0]>=120)})).sort((a,b)=>(b.al-a.al)||b.len-a.len);
    let rem=tgt;const rest=[],left=[];
    for(const b of sc){if(rem<=0){left.push([b.s,b.e]);continue;}const tk=Math.min(b.len,rem);rest.push([b.s,b.s+tk]);rem-=tk;if(tk<b.len)left.push([b.s+tk,b.e]);}
    return{rest,left,met:rem<=0};
  });
}

function save(){
  if(!currentUser)return;
  lsSet(`items_${currentUser.uid}`,items);
  lsSet(`events_${currentUser.uid}`,events);
  lsSet(`rest_${currentUser.uid}`,restTarget);
}

// ══════════════════════════════════════════════════════════════
//  SCHEDULE TAB
// ══════════════════════════════════════════════════════════════
function buildDayPills(){
  const wrap=document.getElementById('day-pills');
  wrap.innerHTML=DAYS.map((d,i)=>`
    <button class="pill${i===selDay?' active':''}" onclick="selDay=${i};renderSchedule()">
      ${DAY_S[i]}${items.some(x=>x.day===i)?`<span class="pill-dot"></span>`:''}
    </button>`).join('');
}
function renderSchedule(){
  buildDayPills();
  const fbd=calcFreeByDay(), rbd=calcRestByDay(fbd);
  const dayItems=items.filter(i=>i.day===selDay).sort((a,b)=>toMin(a.start)-toMin(b.start));
  const rest=rbd[selDay];

  document.getElementById('day-title').textContent='วัน'+DAYS[selDay];
  document.getElementById('day-count').textContent=dayItems.length===0?'ไม่มีกิจกรรม':dayItems.length+' กิจกรรม';

  // Timeline
  const TL=document.getElementById('timeline');
  const totalMin=DAY_END-DAY_START, totalW=totalMin/60*HOUR_W;
  TL.style.minWidth=(totalW+24)+'px';
  let html=`<div class="tl-labels">`;
  for(let h=6;h<=22;h+=2) html+=`<div class="tl-label" style="left:${(h-6)*HOUR_W+(h===6?4:-14)}px">${String(h).padStart(2,'0')}:00</div>`;
  html+=`</div><div class="tl-lane">`;
  for(let h=7;h<=22;h++) html+=`<div class="tl-hour-line" style="left:${(h-6)*HOUR_W}px;border-left:1px ${h%2===0?'solid #E3DCCB':'dashed #EDE7D9'}"></div>`;
  rest.rest.forEach(([s,e])=>html+=`<div class="tl-rest" style="left:${(s-DAY_START)/60*HOUR_W}px;width:${(e-s)/60*HOUR_W}px"></div>`);
  dayItems.forEach(it=>{
    const m=TYPE_META[it.type],s=toMin(it.start),e=toMin(it.end),w=(e-s)/60*HOUR_W;
    html+=`<div class="tl-block" style="left:${(s-DAY_START)/60*HOUR_W}px;width:${Math.max(w,26)}px;background:${m.color}">
      <div class="tl-block-name">${it.name}</div>
      ${w>54?`<div style="opacity:.8;font-size:8.5px">${it.start}-${it.end}</div>`:''}
    </div>`;
  });
  html+=`</div>`;
  TL.innerHTML=html;

  // Item list
  const card=document.getElementById('day-items-card');
  if(dayItems.length>0){
    card.style.display='';
    document.getElementById('day-items-title').textContent='รายการวัน'+DAYS[selDay];
    document.getElementById('day-items-list').innerHTML=dayItems.map(it=>{
      const m=TYPE_META[it.type];
      return`<div class="item-row" style="background:${m.soft}">
        <div class="item-bar" style="background:${m.color}"></div>
        <div style="flex:1"><div class="item-name">${it.name}</div><div class="item-sub">${it.start} – ${it.end} · ${m.label}</div></div>
        <button class="btn-edit" onclick="openEditItem('${it.id}')">✏️ แก้ไข</button>
        <button class="btn-icon" onclick="removeItem('${it.id}')">🗑</button>
      </div>`;
    }).join('');
  }else card.style.display='none';

  // Rest
  const rc=document.getElementById('rest-card');
  if(rest.rest.length>0){
    rc.style.display='';
    document.getElementById('rest-list').innerHTML=rest.rest.map(([s,e])=>
      `<div style="font-size:13px;color:#7A5C1E;margin-bottom:2px">${toLabel(s)} – ${toLabel(e)} <span style="opacity:.7;font-size:11.5px">(${Math.round((e-s)/6)/10} ชม.)</span></div>`
    ).join('')+(rest.met?'':'<p style="font-size:11.5px;color:#C8553D;margin-top:8px">⚠ เวลาว่างไม่พอตามเป้า</p>');
  }else rc.style.display='none';

  renderSummary();
}

function removeItem(id){
  items=items.filter(i=>i.id!==id);save();renderSchedule();
  showToast('ลบกิจกรรมแล้ว','#C8553D');
}

// ══════════════════════════════════════════════════════════════
//  YEARLY TAB
// ══════════════════════════════════════════════════════════════
function calcMonthlyBusy(){
  const hrsByDay=items.reduce((a,i)=>{a[i.day]=(a[i.day]||0)+(toMin(i.end)-toMin(i.start));return a;},{});
  return Array.from({length:12},(_,m)=>{
    let t=0;for(let d=1;d<=daysInMonth(yearView,m);d++){const j=new Date(yearView,m,d).getDay();t+=(hrsByDay[jsDayToOur(j)]||0);}return t/60;
  });
}
function evByDate(){const r={};for(const e of events){if(!r[e.date])r[e.date]=[];r[e.date].push(e);}return r;}

function renderYearly(){
  document.getElementById('year-title').textContent=`ปี ${yearView+543}`;
  const mb=calcMonthlyBusy(), maxMB=Math.max(...mb,1);
  const evs=evByDate(), today=new Date();

  // month pills
  document.getElementById('month-pills').innerHTML=MONTHS.map((m,i)=>
    `<button class="pill${i===selMonth?' active':''}" onclick="selMonth=${i};selDate=null;renderYearly()">${m.slice(0,3)}.</button>`
  ).join('');

  // calendar card
  const numDays=daysInMonth(yearView,selMonth), firstDay=firstDayOfMonth(yearView,selMonth);
  let html=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="kanit" style="font-size:15px;font-weight:700">${MONTHS[selMonth]} ${yearView+543}</span>
      <span style="font-size:12px;color:var(--gray)">${mb[selMonth].toFixed(0)} ชม.เรียน/งาน</span>
    </div>
    <div class="mini-bar"><div class="mini-fill" style="width:${mb[selMonth]/maxMB*100}%"></div></div>
    <div class="cal-grid">
      ${['จ','อ','พ','พฤ','ศ','ส','อา'].map(d=>`<div class="cal-head">${d}</div>`).join('')}
      ${Array.from({length:firstDay},()=>'<div></div>').join('')}
      ${Array.from({length:numDays},(_,i)=>{
        const day=i+1;
        const ds=`${yearView}-${String(selMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const ev=evs[ds]||[];
        const isTd=today.getFullYear()===yearView&&today.getMonth()===selMonth&&today.getDate()===day;
        const isSel=selDate===ds;
        return`<div class="cal-day${isSel?' selected':isTd?' today':''}" onclick="selDate=selDate==='${ds}'?null:'${ds}';renderYearly()">
          ${day}
          ${ev.length?`<div class="cal-dot" style="background:${isSel?'rgba(255,255,255,.8)':EV_META[ev[0].type].color}"></div>`:''}
        </div>`;
      }).join('')}
    </div>`;
  document.getElementById('month-card').innerHTML=html;

  // selected date events
  const sdc=document.getElementById('sel-date-card');
  if(selDate){
    sdc.style.display='';
    const sEvs=evs[selDate]||[];
    sdc.innerHTML=`<p class="kanit" style="font-size:13px;font-weight:700;margin-bottom:8px">${selDate.split('-').reverse().map((v,i)=>i===2?Number(v):v).join('/')}</p>`+
      (sEvs.length===0?`<p style="font-size:13px;color:var(--gray)">ไม่มีกิจกรรมพิเศษ</p>`:
      sEvs.map(e=>{const et=EV_META[e.type];return`<div class="event-row" style="background:${et.bg}">
        <span style="width:8px;height:8px;border-radius:2px;background:${et.color};display:block;flex-shrink:0"></span>
        <span style="flex:1;font-size:13px">${e.name}</span>
        <button class="btn-icon" onclick="removeEvent('${e.id}')">🗑</button>
      </div>`;}).join(''));
  }else sdc.style.display='none';

  // month events list
  const mec=document.getElementById('month-events-card');
  const mEvs=events.filter(e=>e.date.startsWith(`${yearView}-${String(selMonth+1).padStart(2,'0')}`)).sort((a,b)=>a.date.localeCompare(b.date));
  if(mEvs.length>0){
    mec.style.display='';
    mec.innerHTML=`<p class="kanit" style="font-size:13px;font-weight:700;margin-bottom:8px">กิจกรรมเดือนนี้</p>`+
      mEvs.map(e=>{const et=EV_META[e.type],d=Number(e.date.split('-')[2]);
        return`<div class="event-row" style="background:${et.bg}">
          <span class="tag" style="background:${et.color}22;color:${et.color};min-width:28px;justify-content:center">${d}</span>
          <span style="font-size:11.5px;font-weight:700;color:${et.color};flex-shrink:0">${et.label}</span>
          <span style="flex:1;font-size:13px">${e.name}</span>
          <button class="btn-icon" onclick="removeEvent('${e.id}')">🗑</button>
        </div>`;}).join('');
  }else mec.style.display='none';
}

function removeEvent(id){
  events=events.filter(e=>e.id!==id);save();renderYearly();
  showToast('ลบกิจกรรมแล้ว','#C8553D');
}

// ══════════════════════════════════════════════════════════════
//  SUMMARY TAB
// ══════════════════════════════════════════════════════════════
function renderSummary(){
  const fbd=calcFreeByDay(), rbd=calcRestByDay(fbd);
  const totalBusy=items.reduce((s,i)=>s+(toMin(i.end)-toMin(i.start)),0);
  const totalFree=fbd.flat().reduce((s,[a,b])=>s+(b-a),0);
  const totalRest=rbd.reduce((s,d)=>s+d.rest.reduce((x,[a,b])=>x+(b-a),0),0);
  const daysOk=rbd.filter(d=>d.met).length;

  document.getElementById('summary-card').innerHTML=`
    <p class="kanit" style="font-size:15px;margin:0 0 12px;display:flex;align-items:center;gap:6px">
      ⭐ สรุปสัปดาห์นี้</p>
    ${[['เวลาเรียน+งาน',(totalBusy/60).toFixed(1)+' ชม.','#fff'],
       ['เวลาว่างรวม',(totalFree/60).toFixed(1)+' ชม.','#9FD4B8'],
       ['เวลาพักผ่อน',(totalRest/60).toFixed(1)+' ชม.','#F2C879']]
      .map(([l,v,c])=>`<div class="sum-row"><span style="color:#B7C0CF">${l}</span><strong style="color:${c}">${v}</strong></div>`).join('')}
    <div style="height:1px;background:rgba(255,255,255,.12);margin:10px 0"></div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="color:#B7C0CF;font-size:13px">เป้าพักผ่อน/วัน</span>
      <select onchange="restTarget=Number(this.value);save();renderSummary();renderSchedule()"
        style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:7px;padding:5px 8px;font-size:13px">
        ${[0.5,1,1.5,2,2.5,3].map(h=>`<option value="${h}"${restTarget===h?' selected':''}>${h} ชม.</option>`).join('')}
      </select>
    </div>
    <p style="font-size:12px;color:${daysOk===7?'#9FD4B8':'#F2A07A'};margin-top:9px">
      ${daysOk===7?'✓ ทุกวันมีเวลาพักครบ':`⚠ มี ${7-daysOk} วันที่เวลาพักไม่พอ`}</p>`;

  document.getElementById('daily-summary').innerHTML=DAYS.map((d,i)=>{
    const busy=items.filter(x=>x.day===i).reduce((s,x)=>s+(toMin(x.end)-toMin(x.start)),0);
    const free=fbd[i].reduce((s,[a,b])=>s+(b-a),0);
    const rest=rbd[i].rest.reduce((s,[a,b])=>s+(b-a),0);
    if(busy===0)return'';
    return`<div class="card">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span class="kanit" style="font-weight:700;font-size:14px">วัน${d}</span>
        <span style="font-size:12px;font-weight:600;color:${rbd[i].met?'#2E7D56':'#C8553D'}">${rbd[i].met?'✓ พักครบ':'⚠ พักไม่พอ'}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${busy>0?`<span class="tag" style="background:#E8EEF5;color:#3D5A80">${(busy/60).toFixed(1)} ชม.เรียน/งาน</span>`:''}
        ${rest>0?`<span class="tag" style="background:#FBF0D9;color:#9A7B2E">${(rest/60).toFixed(1)} ชม.พัก</span>`:''}
        ${free-rest>0?`<span class="tag" style="background:#EAF3EC;color:#2E7D56">${((free-rest)/60).toFixed(1)} ชม.ว่าง</span>`:''}
      </div>
      <div class="sum-bar">
        ${busy>0?`<div style="flex:${busy};background:#3D5A80"></div>`:''}
        ${rest>0?`<div style="flex:${rest};background:#E8C97A"></div>`:''}
        ${free-rest>0?`<div style="flex:${free-rest};background:#BFD9C8"></div>`:''}
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
//  TOKEN DEBUG
// ══════════════════════════════════════════════════════════════
function showToken(){
  const token=localStorage.getItem('jwt_token')||'';
  const parts=token.split('.');
  document.getElementById('token-display').textContent=
    parts.length===3?`${parts[0]}.\n${parts[1]}.\n${parts[2].slice(0,20)}...`:token;
  const payload=parseJWT(token);
  if(payload){
    const exp=new Date(payload.exp*1000);
    document.getElementById('jwt-payload-box').innerHTML=`
      <div style="font-weight:700;color:var(--navy);margin-bottom:3px">Payload</div>
      <div style="color:var(--gray);font-family:'Courier New',monospace;font-size:10px;line-height:1.6">
        id: ${payload.id}<br>
        email: ${payload.email}<br>
        name: ${payload.name}<br>
        exp: ${exp.toLocaleDateString('th-TH')}
      </div>`;
  }
}

// ══════════════════════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════════════════════
// ── Edit item ──────────────────────────────────────────────────────────────
let editingId=null;

function openEditItem(id){
  const it=items.find(i=>i.id===id);
  if(!it)return;
  editingId=id;
  setEditType(it.type);
  document.getElementById('edit-name').value=it.name;
  document.getElementById('edit-day').value=it.day;
  document.getElementById('edit-start').value=it.start;
  document.getElementById('edit-end').value=it.end;
  document.getElementById('edit-err').textContent='';
  document.getElementById('modal-edit').classList.add('open');
}

function setEditType(t){
  document.getElementById('edit-type-class').className='type-btn'+(t==='class'?' active-class':'');
  document.getElementById('edit-type-work').className='type-btn'+(t==='work'?' active-work':'');
  document.getElementById('edit-type-class').dataset.selected=t==='class'?'1':'';
  document.getElementById('edit-type-work').dataset.selected=t==='work'?'1':'';
}
function getEditType(){
  return document.getElementById('edit-type-class').dataset.selected?'class':'work';
}

function saveEdit(){
  const name=document.getElementById('edit-name').value.trim();
  const day=Number(document.getElementById('edit-day').value);
  const start=document.getElementById('edit-start').value;
  const end=document.getElementById('edit-end').value;
  if(!name)return document.getElementById('edit-err').textContent='กรอกชื่อก่อนนะ';
  if(start>=end)return document.getElementById('edit-err').textContent='เวลาเริ่มต้องน้อยกว่าเวลาเลิก';
  // จำลอง PATCH /items/:id
  items=items.map(i=>i.id===editingId?{...i,type:getEditType(),name,day,start,end}:i);
  save(); selDay=day;
  closeModal('modal-edit'); renderSchedule();
  showToast('แก้ไขกิจกรรมแล้ว ✓','#3D5A80');
}

function deleteFromEdit(){
  if(!confirm('ลบกิจกรรมนี้?'))return;
  items=items.filter(i=>i.id!==editingId);
  save(); closeModal('modal-edit'); renderSchedule();
  showToast('ลบกิจกรรมแล้ว','#C8553D');
}

function openAddItem(){
  document.getElementById('item-name').value='';
  document.getElementById('item-err').textContent='';
  setType('class');
  document.getElementById('modal-item').classList.add('open');
}
function openAddEvent(){
  document.getElementById('ev-date').value=selDate||'';
  document.getElementById('ev-name').value='';
  document.getElementById('ev-err').textContent='';
  document.getElementById('modal-event').classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function closeIfOverlay(e,id){if(e.target===e.currentTarget)closeModal(id);}

function setType(t){
  currentType=t;
  document.getElementById('type-class').className='type-btn'+(t==='class'?' active-class':'');
  document.getElementById('type-work').className='type-btn'+(t==='work'?' active-work':'');
}

function saveItem(){
  const name=document.getElementById('item-name').value.trim();
  const day=Number(document.getElementById('item-day').value);
  const start=document.getElementById('item-start').value;
  const end=document.getElementById('item-end').value;
  if(!name)return document.getElementById('item-err').textContent='กรอกชื่อก่อนนะ';
  if(start>=end)return document.getElementById('item-err').textContent='เวลาเริ่มต้องน้อยกว่าเวลาเลิก';
  // จำลอง POST /items แล้วรับ id กลับ
  items.push({id:'i'+idSeed++,type:currentType,name,day,start,end});
  save(); closeModal('modal-item'); selDay=day;
  renderSchedule(); showToast('เพิ่มกิจกรรมแล้ว ✓','#2E7D56');
}

function saveEvent(){
  const date=document.getElementById('ev-date').value;
  const type=document.getElementById('ev-type').value;
  const name=document.getElementById('ev-name').value.trim();
  if(!date||!name)return document.getElementById('ev-err').textContent='กรอกวันที่และชื่อด้วยนะ';
  events.push({id:'e'+idSeed++,date,type,name});
  save(); closeModal('modal-event'); selDate=date;
  renderYearly(); showToast('เพิ่มกิจกรรมแล้ว ✓','#2E7D56');
}

// ══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
function toggleNotify(){
  notifyOn=!notifyOn;
  document.getElementById('notify-label').textContent=notifyOn?'เตือนเปิด':'เปิดเตือน';
  if(notifyOn){
    if(Notification?.permission==='default') Notification.requestPermission().catch(()=>{});
    notifyInterval=setInterval(checkNotify,30000); checkNotify();
  }else clearInterval(notifyInterval);
}
function checkNotify(){
  const now=new Date(),k0=now.toDateString(),ourDay=jsDayToOur(now.getDay());
  const nowMin=now.getHours()*60+now.getMinutes();
  items.forEach(i=>{
    const diff=toMin(i.start)-nowMin,k=`${k0}-${i.id}`;
    if(i.day===ourDay&&diff>0&&diff<=15&&!notified.has(k)){
      notified.add(k);
      const msg=`${TYPE_META[i.type].label}: ${i.name} เริ่ม ${i.start} น.`;
      showToast(msg,TYPE_META[i.type].color);
      if(Notification?.permission==='granted') try{new Notification('แจ้งเตือน',{body:msg});}catch{}
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════
function switchMainTab(name,btn){
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  btn.classList.add('active');
  if(name==='summary')showToken();
}
function showToast(msg,color){
  const wrap=document.getElementById('toast-wrap');
  const t=document.createElement('div');
  t.className='toast'; t.style.borderLeftColor=color;
  t.innerHTML=`<span style="flex:1">${msg}</span><button onclick="this.parentElement.remove()" style="border:none;background:none;cursor:pointer;color:#B0A99A">✕</button>`;
  wrap.appendChild(t);
  setTimeout(()=>t.remove(),5000);
}

// ══════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  // สร้าง demo user ถ้ายังไม่มี
  const users=getUsers();
  if(!users[DEMO.email]){
    users[DEMO.email]={passwordHash:btoa(DEMO.password),name:DEMO.name,id:'demo-001'};
    saveUsers(users);
  }
  // auto login ถ้ามี token อยู่
  if(!autoLogin()){
    document.getElementById('auth-wrap').style.display='flex';
  }
});
