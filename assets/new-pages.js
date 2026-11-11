// Shared script for the PNW WSO draft pages. Each page only has its own section's elements,
// so every block runs only when its element is on the page. Data: data/new-pages.json
// (scripts/features/build.py, rebuilt daily by the cloud job) and data/referees.json.
(function(){
const has=id=>!!document.getElementById(id);
const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tc=s=>s===s.toUpperCase()?s.split(' ').map(w=>/^[A-Z]{2,4}$/.test(w)&&!/[AEIOU]/.test(w)?w:w.charAt(0)+w.slice(1).toLowerCase()).join(' '):s;
const fd=m=>MON[+m.slice(0,2)-1]+' '+(+m.slice(2));
const prof=(id,n)=>`<a href="https://usaweightlifting.sport80.com/public/rankings/member/${id}" target="_blank" rel="noopener">${esc(n)}</a>`;
function tabs(id,fn){const g=document.getElementById(id);g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));fn(b.dataset.k)});}
// ---- dates, qualifying windows and saved filters (shared by the planner and the qualifying totals page) ----
const isoD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const TODAY=isoD(new Date());
const dOf=s=>new Date(s+'T12:00');
const daysTo=s=>Math.round((dOf(s)-dOf(TODAY))/864e5);
const fmtD=(s,y)=>dOf(s).toLocaleDateString('en-US',y===false?{month:'short',day:'numeric'}:{month:'short',day:'numeric',year:'numeric'});
const fmtRange=(a,b)=>{if(!b||a===b)return fmtD(a);const x=dOf(a),y=dOf(b);return x.getMonth()===y.getMonth()?`${MON[x.getMonth()]} ${x.getDate()}–${y.getDate()}, ${y.getFullYear()}`:`${fmtD(a,false)} – ${fmtD(b)}`};
const away=n=>n===0?'today':n===1?'tomorrow':n<28?`in ${n} days`:`in ${Math.round(n/7)} wks`;
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
// "Mar 4–7, 2027", "Sept 9–12" (year given separately) or "Feb 4, 2026 – Feb 4, 2027" -> [start, end] as YYYY-MM-DD
function parseRange(str,yr){
 const mi=m=>MON.findIndex(x=>x.toLowerCase()===m.slice(0,3).toLowerCase()), iso=(y,m,d)=>`${y}-${String(mi(m)+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const full=[...str.matchAll(/([A-Z][a-z]+)\.? (\d{1,2}), (\d{4})/g)];
 if(full.length>=2)return [iso(full[0][3],full[0][1],full[0][2]),iso(full[1][3],full[1][1],full[1][2])];
 const m=str.match(/([A-Z][a-z]+)\.? (\d{1,2})(?:\s*[–-]\s*(?:([A-Z][a-z]+)\.? )?(\d{1,2}))?(?:, (\d{4}))?/);
 if(!m)return null;const y=m[5]||yr;return [iso(y,m[1],m[2]),iso(y,m[3]||m[1],m[4]||m[2])];
}
// The national events a lifter can qualify for, one entry per event weekend (events that share dates and a
// qualifying window, such as Nationals and Series 1, are one entry). Read from the qualifying totals data.
// Each national event with its own dates and qualifying window (Series 1 and Series 2 are separate entries).
function qualEvents(Q){
 if(!Q)return [];const out=[];
 Q.events.forEach(e=>{try{
  const yr=(e.dates.match(/\d{4}/)||[])[0],dp=e.dates.split(' and '),wp=e.window.split(' · '),pl=e.where.split(' · '),multi=dp.length>1,strip=x=>x.replace(/^[^:]*: /,'');
  dp.forEach((d,i)=>{const r=parseRange(d,yr),w=parseRange(strip(wp[i]||wp[0]));if(!r||!w)return;
   out.push({id:e.key+(multi?i+1:''),keys:[e.key],names:[multi?e.name.replace(/ \d.*$/,'')+' '+(i+1):e.name],where:strip(pl[i]||pl[0]),start:r[0],end:r[1],open:w[0],close:w[1]});});
 }catch(err){console.error(err)}});
 out.forEach(t=>t.name=t.names[0]);return out;
}
function qualTargets(Q){
 const out=qualEvents(Q),g=new Map();
 out.forEach(t=>{const k=t.start+'|'+t.close,x=g.get(k);if(x){x.keys.push(...t.keys);x.names.push(...t.names)}else g.set(k,t)});
 return [...g.values()].map(t=>{const n=t.names;
  t.name=n.length>1&&n.every(x=>/ Nationals$/.test(x))?n.map(x=>x.replace(/ Nationals$/,'')).join(', ').replace(/, ([^,]*)$/,' & $1')+' Nationals':n.join(' & ');return t}).sort((a,b)=>a.close<b.close?-1:1);
}
const tgtCountdown=t=>{const n=daysTo(t.close);return n<0?`<span class="cd">Closed</span>`:`<span class="cd${n<=45?' soon':''}">${plural(n,'day')} <small>left to qualify · closes ${fmtD(t.close)}</small></span>`};
const tgtMeter=t=>{const n=daysTo(t.close),len=(dOf(t.close)-dOf(t.open))/864e5,p=Math.max(0,Math.min(100,100*(1-n/len)));return `<div class="meter${n<=45?' soon':''}" role="img" aria-label="${Math.round(p)}% of the qualifying window has passed"><i style="width:${p.toFixed(1)}%"></i></div>`};
// Filter buttons are remembered on this device, so the page reopens the way the coach left it.
const PAGE_KEY='pnw:'+(location.pathname.split('/').pop()||'index').replace('.html','');
const store={get(k){try{return JSON.parse(localStorage.getItem(PAGE_KEY+':'+k))}catch(e){return null}},set(k,v){try{localStorage.setItem(PAGE_KEY+':'+k,JSON.stringify(v))}catch(e){}}};
function rememberTabs(){
 const saved=store.get('tabs')||{};
 for(let pass=0;pass<2;pass++)Object.entries(saved).forEach(([id,k])=>{const g=document.getElementById(id);if(!g||g.hidden)return;const b=[...g.querySelectorAll('button')].find(x=>x.dataset.k===k);if(b&&!b.disabled&&b.getAttribute('aria-pressed')!=='true')b.click();});
 document.addEventListener('click',e=>{const b=e.target.closest('.tabs button');if(!b||!b.dataset.k)return;const g=b.closest('.tabs');if(!g.id)return;const t=store.get('tabs')||{};t[g.id]=b.dataset.k;store.set('tabs',t);});
}
function render(D){
document.querySelectorAll('.sbSeason').forEach(e=>e.textContent=D.season);
setText('pgUpdated','Updated '+new Date(D.updated+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));
if(has('qtTable')){
// qualifying totals
(function(){
 const Q=D.qt, EV=Q?Object.fromEntries(Q.events.map(e=>[e.key,e.name])):{}, TG=qualTargets(Q);
 const closes=k=>{const c=TG.filter(t=>t.keys.includes(k)&&daysTo(t.close)>=0).map(t=>fmtD(t.close,false));return c.length?`<small>by ${[...new Set(c)].join(' / ')}</small>`:''};
 const st={sex:'W',age:null,sub:null,adp:false};
 const ageBtns=document.getElementById('qtAge'),subBtns=document.getElementById('qtSub'),tbl=document.getElementById('qtTable');
 if(!Q){document.getElementById('qtHead').textContent='Totals not loaded yet';tbl.innerHTML='<tbody><tr><td class="empty">The 2027 totals appear here once they\'re read from USAW\'s 2027 Qualifying Totals PDF. Each weight class gets a row, with one column per national event the age group can qualify for.</td></tr></tbody>';ageBtns.innerHTML=['Open','Youth','Junior','U25','University','Masters'].map((a,i)=>`<button type="button" aria-pressed="${i===0}" disabled>${a}</button>`).join('');return;}
 document.getElementById('qtStatus').textContent='Loaded from USAW\'s 2027 Qualifying Totals.';
 const ages=[...new Set(Q.totals.map(r=>r.age))];st.age=ages[0];
 const subsFor=a=>[...new Set(Q.totals.filter(r=>r.age===a&&r.sub).map(r=>r.sub))];
 ageBtns.innerHTML=ages.map((a,i)=>`<button type="button" data-k="${esc(a)}" aria-pressed="${i===0}">${esc(a)}</button>`).join('');
 function draw(){
  const subs=subsFor(st.age);subBtns.hidden=!subs.length;
  if(subs.length&&!subs.includes(st.sub))st.sub=subs[0];
  subBtns.innerHTML=subs.map(s=>`<button type="button" data-k="${esc(s)}" aria-pressed="${s===st.sub}">${esc(s)}</button>`).join('');
  const rows=Q.totals.filter(r=>r.sex===st.sex&&r.age===st.age&&(!subs.length||r.sub===st.sub));
  const evs=Q.events.map(e=>e.key).filter(k=>rows.some(r=>r.event===k)),classes=[...new Set(rows.map(r=>r.cls))];
  document.getElementById('qtHead').textContent=`${st.sex==='W'?'Women':'Men'} · ${st.age}${subs.length?' '+st.sub:''}${st.adp?' · Adaptive':''}`;
  const val=(c,e)=>{const r=rows.find(x=>x.cls===c&&x.event===e);if(!r)return '—';return st.adp?r.adp:r.total};
  tbl.innerHTML=`<thead><tr><th>Class</th>${evs.map(e=>`<th class="num">${esc(EV[e]||e)}${closes(e)}</th>`).join('')}</tr></thead><tbody>${classes.map(c=>`<tr><td class="wcls">${esc(c)}</td>${evs.map(e=>`<td class="kg">${val(c,e)}</td>`).join('')}</tr>`).join('')||'<tr><td class="empty">No totals for this group.</td></tr>'}</tbody>`;
  tbl.className='stick';
  document.getElementById('qtEvents').innerHTML=TG.filter(t=>t.keys.some(k=>evs.includes(k))).map(t=>`<a class="tgt" href="planner.html#for=${t.id}"><span class="nm">${esc(t.name)}</span><span class="wh">${esc(t.where)} · ${fmtRange(t.start,t.end)}</span>${tgtCountdown(t)}${tgtMeter(t)}<span class="left">Totals count from ${fmtD(t.open)}</span><span class="go">See the meets left →</span></a>`).join('')+(rows.some(r=>r.event==='VWF')&&st.age==='Masters'&&st.sub==='90+'&&st.sex==='M'?'<p class="note" style="margin:6px 0 0">USAW\'s 2027 table has no Finals total for Masters 90+ men\'s 60 kg.</p>':'');
 }
 tabs('qtSex',k=>{st.sex=k;draw()});tabs('qtAge',k=>{st.age=k;st.sub=null;draw()});
 subBtns.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;st.sub=b.dataset.k;draw()});
 tabs('qtAdp',k=>{st.adp=k==='1';draw()});draw();
})();
}
if(has('shForm')){
// shadow request (preview only)
document.getElementById('shForm').addEventListener('submit',e=>{e.preventDefault();document.getElementById('shMsg').textContent='This form isn\'t connected yet, so nothing was sent.'});
}
if(has('recBody')){
// season bests
(function(){
 const B=D.bests, YG=Object.keys(B.youth), st={sex:'W',age:'all',yg:YG[0]};
 const ygLabel=g=>g.replace(' Under',' & Under');
 const ageLabel={all:'All ages',junior:'Junior 15–20',masters:'Masters 35+'};
 const lv={L:'',N:'National',I:'International',A:'NAOS'};
 document.querySelectorAll('.sbSeason').forEach(e=>e.textContent=D.season);
 const yb=document.getElementById('sbYouth');
 yb.innerHTML=YG.map((g,i)=>`<button type="button" data-k="${esc(g)}" aria-pressed="${i===0}">${esc(ygLabel(g))}</button>`).join('');
 function draw(){
  document.getElementById('sbYouth').hidden=st.age!=='youth';
  const set=st.age==='youth'?B.youth[st.yg]:B[st.age];
  const pre=st.sex==='W'?"Women's":"Men's";
  const rows=Object.entries(set).filter(([c])=>c.startsWith(pre));
  document.getElementById('sbHead').textContent=`${st.sex==='W'?'Women':'Men'} · ${st.age==='youth'?'Youth '+ygLabel(st.yg):ageLabel[st.age]}`;
  document.getElementById('recBody').innerHTML=rows.map(([c,b])=>{const cls=esc(c.replace(pre+' ',''));
   return b?`<tr><td class="wcls">${cls}</td><td class="kg">${b[0]}</td><td>${prof(b[5],b[1])}<div class="club">${esc(tc(b[2]))}${lv[b[6]]?' · '+lv[b[6]]:''}</div></td><td class="num">${b[3]}</td><td>${fd(b[4])}</td></tr>`
    :`<tr><td class="wcls">${cls}</td><td class="kg">—</td><td class="empty" colspan="3">No result yet this season</td></tr>`}).join('');
 }
 tabs('sbSex',k=>{st.sex=k;draw()});tabs('sbAge',k=>{st.age=k;draw()});tabs('sbYouth',k=>{st.yg=k;draw()});draw();
})();
}
if(has('awCards')){
// awards
const cats=[['WYouth','Youth women','qy'],['MYouth','Youth men','qy'],['WJunior','Junior women','q'],['MJunior','Junior men','q'],['WSenior','Senior women','q'],['MSenior','Senior men','q'],['WMasters','Masters women','qm'],['MMasters','Masters men','qm']];
const LAB={q:'Q-points',qm:'Q-Masters',qy:'Q-Youth'};
const clsTxt=c=>c.replace(/(Wo)?men's /i,'').replace(' Under',' & Under');
document.getElementById('awCards').innerHTML=cats.map(([k,l,key])=>{const a=D.awards[k];if(!a||!a.length)return '';const w=a[0];
 const st=r=>r.est?'<sup class="est" title="Under 10: scored with age-10 factors">*</sup>':'';const anyEst=a.some(r=>r.est);
 return `<div class="aw ${k[0]==='M'?'m':''}"><span class="cat">${l}</span><span class="who">${prof(w.id,w.name)}${st(w)}</span><span class="meta">${w.club?esc(tc(w.club))+' · ':''}${esc(clsTxt(w.cls))} · age ${w.age}</span><span class="sinc">${w[key].toFixed(1)}${st(w)} <small>${LAB[key]} · ${w.total} kg at ${w.bw}</small></span><ol start="2">${a.slice(1).map(r=>`<li>${esc(r.name)}${st(r)} · ${r[key].toFixed(1)}</li>`).join('')}</ol>${anyEst?'<p class="estnote">* Under 10. Q-Youth starts at age 10, so this score uses the age-10 factors and is an estimate.</p>':''}</div>`}).join('');
const ovSt={set:'open',sex:'W'};
function ov(){const y=ovSt.set==='youth',key=y?'qy':'q',list=(y?D.youthOverall:D.overall)[ovSt.sex];
 document.getElementById('ovHead').textContent=y?'All youth lifters · Q-Youth':'Best lifter, all ages · Q-points';
 document.getElementById('ovScoreCol').textContent=LAB[key];
 document.getElementById('ovBody').innerHTML=list.map((r,i)=>`<tr><td class="num">${i+1}</td><td>${prof(r.id,r.name)}<div class="club">${esc(tc(r.club))}</div></td><td>${esc(clsTxt(r.cls))}</td><td class="num">${r.age}</td><td class="kg">${r.total}</td><td class="num">${r.bw}</td><td class="kg">${r[key].toFixed(1)}${r.est?'<sup class="est">*</sup>':''}</td></tr>`).join('')+(y&&list.some(r=>r.est)?'<tr><td colspan="7" class="estnote">* Under 10, scored with the age-10 Q-Youth factors (the youngest the calculator covers).</td></tr>':'');}
tabs('ovSet',k=>{ovSt.set=k;ov()});tabs('ovTabs',k=>{ovSt.sex=k;ov()});ov();
document.getElementById('miSeason').textContent=D.archive.season;document.getElementById('miNext').textContent=D.archive.season+1;
document.getElementById('miCount').textContent=D.archive.lifters;document.getElementById('miQy').textContent=D.archive.withQy;
}
if(has('clubBody')){
// clubs
const tm={set:'open',scope:'season',div:'A'};
const ord=n=>n+(['th','st','nd','rd'][(n%100>10&&n%100<14)?0:(n%10<4?n%10:0)]||'th');
function teams(){const t=D.teams[tm.set][tm.scope][tm.div];const mx=t.length?t[0].pts:1;const y=tm.set==='youth';
 document.getElementById('tmHow').textContent=y?'Youth: all PNW youth lifters are ranked together by Q-Youth, women and men separately. The top 25 earn the same 28, 25, 23 … 1 points, and each club\'s best 5 girls and 5 boys count. * Under 10, scored with the age-10 Q-Youth factors.':'Open classes: place by total within each weight class, all ages.';
 document.getElementById('tmFirstCol').textContent=y?'1st places':'Class wins';
 document.getElementById('clubBody').innerHTML=t.map((c,i)=>`<tr class="clubrow" data-i="${i}" tabindex="0" aria-expanded="false"><td class="num">${i+1}</td><td>${esc(tc(c.club))}</td><td class="kg">${c.pts}</td><td class="barcell"><div class="bar" style="width:${(c.pts/mx*100).toFixed(1)}%"></div></td><td class="num">${c.n}</td><td class="num">${c.firsts||''}</td></tr><tr class="scorers" hidden><td></td><td colspan="5">${[...c.top].sort((a,b)=>b[3]-a[3]).map(s=>`${esc(s[0])} <span class="club">${esc(s[1])} · ${ord(s[2])} · ${s[3]} pts</span>`).join('<br>')}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No scoring results in this period.</td></tr>';}
document.getElementById('clubBody').addEventListener('click',e=>{const r=e.target.closest('.clubrow');if(!r)return;const n=r.nextElementSibling;n.hidden=!n.hidden;r.setAttribute('aria-expanded',!n.hidden);});
document.getElementById('clubBody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('clubrow')){e.preventDefault();e.target.click();}});
tabs('tmSet',k=>{tm.set=k;teams()});tabs('tmScope',k=>{tm.scope=k;teams()});tabs('tmDiv',k=>{tm.div=k;teams()});teams();
}
if(has('adpList')){
// adaptive
const sess=g=>{g=g.replace(/^ADA?P /,'');const s=/W\d*$/.test(g)?'women':'men';const m=g.match(/[WM](\d\d)$/);if(m)return `Masters ${m[1]}–${+m[1]+4} ${s}`;const k={JR:'Junior',U17:'U17',U25:'U25',UNI:'University'}[g.split(' ')[0]];return (k||'Open')+' '+s};
(function(){const A=D.adaptive;const ev=A.events.length;
 document.getElementById('adpNote').textContent=`Checked ${ev} national events (${A.events.join(', ')}): ${A.placings} adaptive placings in total, ${A.athletes.reduce((n,a)=>n+a.results.length,0)} by opted-in PNW athletes.`;
 document.getElementById('adpList').innerHTML=A.athletes.map(a=>`<div class="aw adp" style="max-width:none"><span class="cat">${a.cat?'Adaptive · '+esc(a.cat):'Adaptive'}</span><span class="who">${prof(a.id,a.name)}</span><span class="meta">${esc(tc(a.club))}</span>${a.results.length?`<div class="tscroll"><table><thead><tr><th>Event</th><th>Session</th><th>Class</th><th class="num">Place</th><th class="num">Total</th><th class="num">Score</th></tr></thead><tbody>${a.results.map(r=>`<tr><td>${esc(r.event)}</td><td>${esc(sess(r.group))}</td><td>${esc(r.cls)}</td><td class="num">${r.place}</td><td class="kg">${r.total}</td><td class="num">${r.score.toFixed(1)} <span class="club">${esc(r.scoring.split(' ')[0])}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty" style="margin:4px 0 0">No adaptive session results found yet this season.</p>'}</div>`).join('')||'<p class="empty">No opted-in adaptive athletes yet.</p>';})();
}
if(has('monthChart')){
// month chart
(function(){const v=D.byMonth,W=640,H=220,pl=34,pb=26,pt=14,max=Math.ceil(Math.max(...v)/50)*50,bw=(W-pl-8)/12;
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Season-best totals per month">`;
 for(let t=0;t<=max;t+=50){const y=H-pb-(t/max)*(H-pb-pt);s+=`<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--rule)"/><text x="${pl-6}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${t}</text>`}
 v.forEach((n,i)=>{const h=(n/max)*(H-pb-pt),x=pl+4+i*bw;const post=i>=7;
  s+=`<rect x="${x}" y="${H-pb-h}" width="${bw-8}" height="${h}" rx="3" fill="${post?'var(--brand-gold)':'var(--brand-blue)'}"/><text x="${x+(bw-8)/2}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--faint)" font-family="Inter,sans-serif">${MON[i]}</text>`;
  if(n)s+=`<text x="${x+(bw-8)/2}" y="${H-pb-h-4}" text-anchor="middle" font-size="10.5" fill="var(--dim)" font-family="IBM Plex Mono,monospace">${n}</text>`});
 document.getElementById('monthChart').innerHTML=s+'</svg>';})();
}
if(has('letter')){
// quarterly letter
(function(){
 const Q=D.quarter;
 const meet=(d,l)=>{if(l==='I'&&d>='0826'&&d<='0830')return '2026 Pan American Youth Championships';if(d==='0829'||d==='0830')return 'Paramount Grand Prix';if(d>='0911'&&d<='0913')return 'Virus Weightlifting Series 2';if(d>='0925'&&d<='0927'&&l==='N')return 'Wodapalooza SoCal';if(d==='1003'||d==='1004')return 'the PNW WSO Championship';return '';};
 const at=(d,l)=>{const m=meet(d,l);return m?` at ${m}`:` on ${fd(d)}`};
 const cl=c=>c.replace(/^(Wo)?men's /i,'').replace(/^(\d+)\+kg$/,'+$1 kg').replace(/(\d)kg$/,'$1 kg');
 const word=n=>['zero','one','two','three','four','five','six','seven','eight','nine','ten'][n]||String(n);
 const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
 const sexw=c=>c.startsWith('Women')?'women':'men';
 const champs=(Q.byDate['1003']||0)+(Q.byDate['1004']||0);
 const top3=D.teams.open.since.A.slice(0,3);const ytop=D.teams.youth.since.A.slice(0,2);
 const qw=Q.bestQ.W[0],qmn=Q.bestQ.M[0];
 const youthTop=Q.youth.filter(y=>!Q.intl.some(i=>i[0]===y.name)).slice(0,4);
 // USAW's men's 95 kg national list shows a total above Wiitanen's that was entered in error, so his 359 kg is the top legitimate total.
 const US_FIX={'Daniel Wiitanen':1};
 const nat=Q.usTop10.map(r=>({...r,us:US_FIX[r.name]||r.us})).sort((a,b)=>a.us-b.us);
 const ord2=n=>n===1?'the top total':`#${n}`;
 const blocks=[
  ['p',`Dear PNW lifters, coaches, clubs and meet directors,`],
  ['p',`Here is our update for August 1 through ${new Date(D.updated+'T12:00').toLocaleDateString('en-US',{month:'long',day:'numeric'})}, the first quarter under USA Weightlifting's new bodyweight categories.`],

  ['h','New weight classes'],
  ['p',`USAW moved to the new IWF bodyweight categories on August 1. Rankings, season bests and national qualifying totals all use them now.`],
  ['ul',[`Senior and junior women: 49, 53, 57, 61, 69, 77, 86 and +86 kg`,`Senior and junior men: 60, 65, 70, 75, 85, 95, 110 and +110 kg`,`Youth: 45 to +77 kg for girls and 55 to +95 kg for boys, with separate classes for 13 & Under and 11 & Under`]],

  ['h','By the numbers'],
  ['p',`It was a busy first quarter in the new classes.`],
  ['ul',[`${Q.lifters} PNW lifters from ${Q.clubs} clubs set ${Q.results} season-best totals`,`${champs} of them came at the PNW WSO Championship on October 3–4, our busiest weekend of the year`,`${Q.national} came at national meets, mostly Virus Weightlifting Series 2 in September`]],

  ['h','On the national stage'],
  ['p',`${cap(word(nat.length))} PNW lifters rank in the top 10 in the country in their class.`],
  ['ul',nat.map(r=>`${r.name} (${tc(r.club)}): ${ord2(r.us)} in the US in the ${sexw(r.cls)}'s ${cl(r.cls)}, ${r.total} kg${at(r.date,r.lvl)}`)],

  ['h','Representing the US'],
  ['p',`Four PNW lifters competed for Team USA this quarter, and all four delivered.`],
  ['ul',[`Katharine Estep (Alpha Barbell): 6th in the world in the women's 61 kg at the IWF World Championships in Ningbo, China, with 104 kg, 130 kg and 234 kg`,`Reagan Herchold (Puget Sound Weightlifting): gold in the snatch, the clean & jerk and the total in the U15 women's 57 kg at the Pan American U15 and U17 Championships in Guayaquil, Ecuador, with 71 kg, 85 kg and 156 kg`,`Kaia Jacobs (Heroic Barbell): bronze in the snatch, the clean & jerk and the total in the U17 women's +77 kg at the same Pan American Championships, with 88 kg, 115 kg and 203 kg`,`Piper Jones (Catalyst Athletics): bronze in the clean & jerk and the total in the U17 women's 53 kg at the Pan American Championships, with 64 kg, 84 kg and 148 kg`]],

  ['h','Best lifters'],
  ['p',`Scored with Q-points, the method USAW uses to name Best Lifter at its national events, the top performances since August 1 were:`],
  ['ul',[`${qw.name} (${tc(qw.club)}): ${qw.q.toFixed(1)} Q-points, ${qw.total} kg at ${qw.bw} kg bodyweight${at(qw.date,qw.lvl)}`,`${qmn.name} (${tc(qmn.club)}): ${qmn.q.toFixed(1)} Q-points, ${qmn.total} kg at ${qmn.bw} kg bodyweight${at(qmn.date,qmn.lvl)}`]],

  ['h','Youth'],
  ['p',`Beyond the Pan Am team, PNW youth lifters are near the top of the national youth rankings.`],
  ['ul',youthTop.map(y=>`${y.name} (${tc(y.club)}): #${y.us} in the US in the ${y.group.replace(' Under',' & Under').replace('-','–')} ${cl(y.cls)}, ${y.total} kg`)],

  ['h','Club standings'],
  ['p',`Clubs are scored the way USAW scores teams at national meets, with each club's best five women and five men counting. Youth clubs have their own table, scored on Q-Youth.`],
  ['ul',[...top3.map((t,i)=>`${['1st','2nd','3rd'][i]} overall: ${tc(t.club)}, ${t.pts} points`),...ytop.map((t,i)=>`${['1st','2nd'][i]} among youth clubs: ${tc(t.club)}, ${t.pts} points`)]],

  ['h','2027 national events'],
  ['p',`USAW's 2027 qualifying totals take effect January 1, and each event has its own qualifying window.`],
  ['ul',[`National Championships & Virus Series 1, Columbus, OH, March 4–7: general registration opens November 10 and closes February 4`,`Masters & University Nationals, Richmond, VA, April 15–18`,`Youth, Junior & U25 Nationals, Colorado Springs, CO, June 22–27`,`Virus Series 2, Fort Worth, TX, September 9–12`,`Virus Finals, San Juan, Puerto Rico, December 2–5`]],

  ['h','New on the PNW WSO site'],
  ['p',`The site has grown this quarter.`],
  ['ul',[`Competition calendar: USAW-sanctioned meets, courses and camps in Alaska, Oregon and Washington, plus national events, updated daily`,`Rankings: every PNW lifter by weight class, age group and club, updated each Wednesday`,`Season bests, outstanding athletes and club standings, built from the rankings`,`2027 qualifying totals for every national event, filtered by age group, including adaptive totals`,`Adaptive results for athletes who opt in through the adaptive form`,`Add Your Event, for meet directors listing a planned meet`,`Coach shadowing requests for 2027 national events`]],

  ['h','Coming up'],
  ['p',`Mark your calendar.`],
  ['ul',[`Valley Strength Harvest, November 22`,`USAW Level 1 courses in Portland, Richland, Anchorage and Federal Way, and Level 2 in Portland, November and December`,`Virus Weightlifting Finals, December 3–6`,`Third Pull and Winter Lifting-Land, January 23–24`,`Cully Strength Winter Open, February 6`,`Seattle Barbell Classic, February 13`]],

  ['h','How you can help'],
  ['p',`Two ways to get involved:`],
  ['ul',[`Planning a meet? Add it to the calendar so lifters can plan around it.`,`Coaches can ask to shadow an experienced PNW coach at a 2027 national event.`]],

  ['p',`Thanks for lifting, coaching and hosting in the PNW.`],
  ['p',`Jacob Howard\nPNW WSO Board\n[contact email]`],
 ];
 const html=blocks.map(([t,v])=>t==='h'?`<h4>${esc(v)}</h4>`:t==='ul'?`<ul>${v.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p>${esc(v).replace(/\[([^\]]+)\]/g,'<span class="ph">[$1]</span>').replace(/\n/g,'<br>')}</p>`).join('');
 document.getElementById('letter').innerHTML=`<p class="lt-sub">PNW WSO Quarterly Update · August–October ${D.season}</p>`+html;
 const text=`PNW WSO Quarterly Update: August–October ${D.season}\n\n`+blocks.map(([t,v],i)=>t==='h'?'\n'+v.toUpperCase():t==='ul'?v.map(x=>'  • '+x).join('\n'):v).join('\n\n').replace(/\n{3,}/g,'\n\n');
 document.getElementById('copyNl').addEventListener('click',()=>{const m=document.getElementById('copyMsg');
  navigator.clipboard.writeText(text).then(()=>m.textContent='Copied',()=>{const r=document.createRange();r.selectNodeContents(document.getElementById('letter'));const s=getSelection();s.removeAllRanges();s.addRange(r);m.textContent='Letter selected; copy it manually'});});
})();
}
if(has('plAgenda')){
// season planner: qualifying windows, national events and the sanctioned PNW meets left inside each window
Promise.all(['sport80-events','usaw-national-events','local-events'].map(n=>fetch(`data/${n}.json`,{cache:'no-cache'}).then(r=>r.json()).catch(()=>null))).then(([S,U,LE])=>{
 const T=qualTargets(D.qt), items=[];
 const norm=x=>x.toLowerCase().replace(/\b20\d\d\b/g,'').replace(/[^a-z]/g,'');
 const nice=x=>tc(x).replace(/, (Ak|Or|Wa)\b/g,m=>m.toUpperCase());
 const ST={Alaska:'AK',Oregon:'OR',Washington:'WA'};
 if(S){
  [['meets','meet','Enter'],['courses','course','Register'],['camps','course','Register']].forEach(([list,type,cta])=>(S.lists[list]||[]).forEach(e=>items.push({type,date:e.start,end:e.end||e.start,title:nice(e.name),place:[e.city,e.state].filter(Boolean).join(', '),loc:e.address,kind:e.type,state:e.state,url:e.entryUrl||e.url,cta,counts:type==='meet'})));
  (S.unlisted||[]).filter(e=>e.pageLive).forEach(e=>items.push({type:e.list==='meets'?'meet':'course',date:e.start,end:e.end||e.start,title:nice(e.name),place:[e.city,e.state].filter(Boolean).join(', '),loc:e.address,kind:e.type,state:e.state,url:e.eventPage||e.entryUrl,cta:'Event page',counts:e.list==='meets',flag:'Off USAW\'s public list · may be full'}));
 }
 const natStarts=new Set(),natBy={};
 const regLabel=x=>x.replace(/\s*\((?!\$)[^)]*\)/g,'').replace(/\s+/g,' ').trim();
 const regs=e=>(e.keyDates||[]).filter(k=>/registration/i.test(k.label)&&k.date);
 if(U)(U.events||[]).forEach(e=>{natStarts.add(e.start);natBy[e.start]=e;
  regs(e).forEach(k=>{const more=(k.label.match(/\((?!\$)([^)]*)\)/)||[])[1];items.push({type:'reg',date:k.date,end:k.end||k.date,title:`${regLabel(k.label)}: ${e.name.replace(/^20\d\d\s+/,'')}`,place:k.text,kind:more||'',url:e.eventPage,cta:'Event page',tstart:e.start})});items.push({type:'national',date:e.start,end:e.end||e.start,title:e.name,place:e.location.split(' | ')[0].replace(', United States',''),loc:e.location,kind:'USAW national event',url:e.eventPage,cta:'Event page',counts:true})});
 T.forEach(t=>{
  if(!natStarts.has(t.start))items.push({type:'national',date:t.start,end:t.end,title:t.name,place:t.where,loc:t.where,kind:'USAW national event',counts:true});
  items.push({type:'deadline',date:t.close,end:t.close,title:`Last day to qualify: ${t.name}`,place:`Event ${fmtRange(t.start,t.end)} · ${t.where}`,kind:`Totals count from ${fmtD(t.open)}`,tid:t.id});
 });
 if(LE){const have=items.filter(i=>i.type==='meet').map(i=>norm(i.title));
  (LE.rows||[]).filter(r=>r['Event Type']==='Sanctioned Meet'&&r['Planned Date']).forEach(r=>{const n=norm(r['Name of Event']);if(have.some(h=>h.includes(n)||n.includes(h)))return;
   const d=new Date(r['Planned Date']).toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});const web=/^https?:\/\//i.test(r['Event Website']||'')?r['Event Website']:'';
   items.push({type:'planned',date:d,end:d,title:r['Name of Event'],place:[r.City,ST[r.State]||r.State].filter(Boolean).join(', '),loc:r.Venue,kind:'Planned by '+(r['Host Club']||'the host'),state:ST[r.State]||'',url:web,cta:'Details',counts:false,flag:'Not yet on USAW\'s list'})});}
 const up=items.filter(i=>i.end>=TODAY).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.type==='deadline')-(b.type==='deadline'));
 // meets that can still produce a qualifying total for a target: sanctioned, and finished inside its window
 const leftFor=t=>up.filter(i=>i.counts&&i.date>=t.open&&i.end<=t.close&&i.date!==t.start);
 const pnw=l=>l.filter(i=>i.type==='meet');
 // registration line for an event card, from the dates on USAW's event page
 const regLine=t=>{const e=natBy[t.start],r=e?regs(e):[];if(!r.length)return 'Registration dates not posted by USAW yet';
  const op=r.filter(k=>/open/i.test(k.label)),cl=r.filter(k=>/close/i.test(k.label)),next=cl.find(k=>k.date>=TODAY),soon=op.find(k=>k.date>TODAY);
  if(cl.length&&!next)return 'Registration has closed';
  if(soon&&!op.some(k=>k.date<=TODAY))return `<b>Registration opens ${fmtD(soon.date)}</b>`;
  return `<b>Registration is open</b>${next?` · ${esc(regLabel(next.label).replace(/\s*registration\s*/i,' ').trim().toLowerCase())} ${fmtD(next.date)}`:''}`;};
 const fromHash=()=>{const m=location.hash.match(/for=([\w]+)/);if(!m)return null;const t=T.find(t=>t.id===m[1])||T.find(t=>t.keys.includes(m[1]));return t?t.id:null};
 const st={sel:fromHash()||store.get('for')||'',type:'all',state:'all'};
 if(!T.some(t=>t.id===st.sel))st.sel='';
 function ics(list,name){
  const z=d=>d.replace(/-/g,''),next=d=>{const x=dOf(d);x.setDate(x.getDate()+1);return isoD(x)},e=x=>String(x||'').replace(/([,;\\])/g,'\\$1').replace(/\n/g,'\\n');
  const body=list.map((i,n)=>['BEGIN:VEVENT',`UID:${z(i.date)}-${n}-${norm(i.title).slice(0,30)}@pnwwso`,`DTSTAMP:${z(TODAY)}T120000Z`,`DTSTART;VALUE=DATE:${z(i.date)}`,`DTEND;VALUE=DATE:${z(next(i.end))}`,`SUMMARY:${e(i.title)}`,`DESCRIPTION:${e([i.kind,i.place,i.url].filter(Boolean).join('\n'))}`,i.loc?`LOCATION:${e(i.loc)}`:'','END:VEVENT'].filter(Boolean).join('\r\n')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PNW WSO//Season planner//EN\r\n${body}\r\nEND:VCALENDAR\r\n`],{type:'text/calendar'}));a.download=name+'.ics';document.body.appendChild(a);a.click();a.remove();
 }
 let shown=[];
 function draw(){
  const sel=T.find(t=>t.id===st.sel),open=T.filter(t=>daysTo(t.close)>=0),nextT=open[0],meets=up.filter(i=>i.type==='meet'),nm=meets[0];
  const focus=sel||nextT, fl=focus?leftFor(focus):[];
  document.getElementById('plStats').innerHTML=[
   nextT?`<div class="stat"><span class="k">Next qualifying deadline</span><span class="v">${plural(daysTo(nextT.close),'day')}</span><span class="d">${esc(nextT.name)} · ${fmtD(nextT.close)}</span></div>`:'',
   nm?`<div class="stat"><span class="k">Next PNW sanctioned meet</span><span class="v">${fmtD(nm.date,false)} <small>${away(daysTo(nm.date))}</small></span><span class="d">${esc(nm.title)} · ${esc(nm.place)}</span></div>`:`<div class="stat"><span class="k">Next PNW sanctioned meet</span><span class="v">—</span><span class="d">None listed on USAW right now</span></div>`,
   focus?`<div class="stat"><span class="k">PNW meets left to qualify</span><span class="v">${pnw(fl).length}</span><span class="d">before the ${esc(focus.name)} window closes</span></div>`:''].join('');
  document.getElementById('plTargets').innerHTML=T.map(t=>{const l=leftFor(t),p=pnw(l).length,n=l.length-p,closed=daysTo(t.close)<0;
   return `<button type="button" class="tgt" data-t="${t.id}" aria-pressed="${t.id===st.sel}"><span class="nm">${esc(t.name)}</span><span class="wh">${esc(t.where)} · ${fmtRange(t.start,t.end)}</span>${tgtCountdown(t)}${tgtMeter(t)}<span class="left">${closed?'The qualifying window has closed':`<b>${plural(p,'PNW meet')}</b>${n?` and ${plural(n,'national event')}`:''} left in the window`}</span><span class="left">${regLine(t)}</span></button>`}).join('')||'<p class="empty">The 2027 qualifying windows aren\'t loaded yet.</p>';
  const F=document.getElementById('plFocus');
  if(sel){const l=fl,p=pnw(l),last=p[p.length-1],n=daysTo(sel.close);
   F.innerHTML=`<div class="focus-note"><p><b>${esc(sel.name)}</b> · ${fmtRange(sel.start,sel.end)}, ${esc(sel.where)}. A total counts if it was made at a USAW-sanctioned meet from ${fmtD(sel.open)} through ${fmtD(sel.close)}${n>=0?` (${plural(n,'day')} left)`:''}. ${p.length?`${plural(p.length,'PNW meet')} left in that window; the last is ${esc(last.title)} on ${fmtD(last.end)}.`:n>=0?'No PNW meets are listed inside that window yet.':''}</p><span><a class="linkbtn" href="roster.html#for=${sel.id}">Who has qualified →</a> &nbsp; <button type="button" class="linkbtn" id="plIcsSel">Add these to my calendar</button> &nbsp; <button type="button" class="linkbtn" id="plClear">Show everything</button></span></div>`;
  }else F.innerHTML='';
  shown=up.filter(i=>(st.type==='all'||i.type===st.type||(st.type==='meet'&&i.type==='planned'))&&(st.state==='all'||!i.state||i.state===st.state));
  let h='',mon='';
  shown.forEach((i,ix)=>{const d=dOf(i.date),m=d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
   if(m!==mon){h+=(mon?'</ul>':'')+`<h3 class="month">${m}</h3><ul class="agenda">`;mon=m}
   const inWin=sel&&i.counts&&i.date>=sel.open&&i.end<=sel.close&&i.date!==sel.start,own=sel&&(i.tid===sel.id||(i.type==='national'&&i.date===sel.start));
   const off=sel&&!own&&!inWin&&i.tstart!==sel.start&&(i.type==='meet'||i.type==='planned'||i.type==='national'||i.type==='deadline'||i.type==='reg');
   const chips=[inWin?'<span class="chip ok">Counts toward qualifying</span>':'',sel&&i.type==='national'&&i.date===sel.start?'<span class="chip">The event you\'re planning for</span>':'',sel&&i.counts&&!inWin&&!own&&i.end>sel.close?'<span class="chip">After the window</span>':'',i.flag?`<span class="chip red">${esc(i.flag)}</span>`:''].join('');
   h+=`<li class="ag ${i.type}${off?' off':''}"><div class="dt"><b>${d.getDate()}</b><span>${MON[d.getMonth()]}</span></div><div><div class="ti">${esc(i.title)}</div><div class="su">${[i.end!==i.date?fmtRange(i.date,i.end):'',esc(i.place||''),esc(i.kind||'')].filter(Boolean).join(' · ')}</div>${chips?`<div class="tg">${chips}</div>`:''}</div><div class="act"><span class="away">${away(daysTo(i.date))}</span><span class="links">${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">${i.cta}</a>`:''}<button type="button" data-ics="${ix}" aria-label="Add ${esc(i.title)} to my calendar">Add to calendar</button></span></div></li>`;});
  document.getElementById('plAgenda').innerHTML=h?h+'</ul>':'<p class="empty">Nothing matches these filters.</p>';
 }
 document.getElementById('plTargets').addEventListener('click',e=>{const b=e.target.closest('.tgt');if(!b)return;st.sel=st.sel===b.dataset.t?'':b.dataset.t;store.set('for',st.sel);history.replaceState(null,'',st.sel?'#for='+st.sel:location.pathname+location.search);draw();});
 document.getElementById('plFocus').addEventListener('click',e=>{const sel=T.find(t=>t.id===st.sel);if(!sel)return;
  if(e.target.id==='plClear'){st.sel='';store.set('for','');history.replaceState(null,'',location.pathname+location.search);draw();}
  if(e.target.id==='plIcsSel')ics([...pnw(leftFor(sel)),up.find(i=>i.tid===sel.id)].filter(Boolean),'pnw-'+sel.id.toLowerCase()+'-qualifying');});
 document.getElementById('plAgenda').addEventListener('click',e=>{const b=e.target.closest('[data-ics]');if(b){const i=shown[+b.dataset.ics];ics([i],'pnw-'+norm(i.title).slice(0,30));}});
 document.getElementById('plIcsAll').addEventListener('click',()=>ics(up.filter(i=>i.type==='deadline'),'pnw-qualifying-deadlines'));
 tabs('plType',k=>{st.type=k;draw()});tabs('plState',k=>{st.state=k;draw()});draw();rememberTabs();
});
}
if(has('rtList')){
// qualifying tracker: every ranked PNW lifter's totals against the qualifying totals and windows for one national event
Promise.all([fetch('data/rankings.json',{cache:'no-cache'}).then(r=>r.json()),fetch('data/results.json',{cache:'no-cache'}).then(r=>r.json()).catch(()=>null)]).then(([R,RS])=>{
 const FULL=!!(RS&&RS.lifters&&RS.meets);
 const Q=D.qt,EVS=qualEvents(Q).sort((a,b)=>a.close<b.close?-1:1),C=R.clubs;
 const lim=c=>c.includes('+')?Infinity:parseFloat(c);
 // qualifying totals by event, age group, sub-group and sex, lightest class first
 const QT={};Q.totals.forEach(t=>{const k=[t.event,t.age,t.sub||'',t.sex].join('|');(QT[k]=QT[k]||[]).push(t)});
 Object.values(QT).forEach(a=>a.sort((x,y)=>lim(x.cls)-lim(y.cls)));
 const AGES={};Q.totals.forEach(t=>(AGES[t.event]=AGES[t.event]||new Set()).add(t.age));
 // Every result saved for each lifter (data/results.json: all meets since last season, with birth year).
 // If that file can't be loaded, fall back to the rankings, which only have each lifter's best total per class.
 const L=new Map();
 if(FULL)Object.entries(RS.lifters).forEach(([id,l])=>L.set(+id,{id:+id,name:l.n,club:l.c||'',sex:l.s,by:l.by,res:l.r.filter(x=>x[2]>0).map(x=>({date:x[0],total:x[1],bw:x[2],sn:x[3],cj:x[4],meet:RS.meets[x[6]]||''}))}));
 else{
  const add=(cls,x)=>{const sex=cls.startsWith('Women')?'W':'M',d=`${R.season}-${x[7].slice(0,2)}-${x[7].slice(2)}`;
   let l=L.get(x[9]);if(!l)L.set(x[9],l={id:x[9],name:x[3],club:x[4]>=0?C[x[4]]:'',sex,by:R.season-x[5],res:[]});
   if(!l.res.some(r=>r.total===x[2]&&r.date===d&&r.bw===x[6]))l.res.push({total:x[2],bw:x[6],date:d,meet:''});};
  Object.entries(R.classes).forEach(([c,xs])=>xs.forEach(x=>add(c,x)));
  Object.values(R.youth||{}).forEach(g=>Object.entries(g).forEach(([c,xs])=>xs.forEach(x=>add(c,x))));
  const k=document.getElementById('rtLegacyKey');if(k)k.insertAdjacentText('beforeend',' The full results file didn\'t load, so this page is using each lifter\'s best total only; a smaller total made later may already qualify them.');
 }
 const lifters=[...L.values()];
 // the age groups a lifter can enter, by the age they turn in the event's year (event year minus birth year)
 function tracks(ev,l){const a=dOf(ev.start).getFullYear()-l.by,out=[];
  (AGES[ev.keys[0]]||[]).forEach(g=>{
   if(g==='Open')out.push([g,'']);
   else if(g==='Junior'){if(a>=15&&a<=20)out.push([g,''])}
   else if(g==='U25'){if(a>=15&&a<=25)out.push([g,''])}
   else if(g==='University'){if(a>=17&&a<=28)out.push([g,''])}
   else if(g==='Youth'){if(a<=17)out.push([g,a>=16?'16–17':a>=14?'14–15':a>=12?'12–13':'11 & Under'])}
   else if(g==='Masters'){if(a>=35){const lo=Math.floor(a/5)*5;out.push([g,a>=90?'90+':`${lo}–${lo+4}`])}}
  });return {age:a,list:out};}
 // One lifter against one event, for each age group they can enter. USAW's rule: the total must be made inside the
 // event's window and must meet the qualifying total for the class the lifter was in that day (taken from bodyweight);
 // a lifter who has done that may register in any class. Every saved result is checked.
 function standing(ev,l){const tr=tracks(ev,l),rows=[];
  tr.list.forEach(([g,sub])=>{const tbl=QT[[ev.keys[0],g,sub,l.sex].join('|')];if(!tbl)return;let best=null;
   l.res.forEach(r=>{const q=tbl.find(t=>r.bw<=lim(t.cls));if(!q)return;const inWin=r.date>=ev.open&&r.date<=ev.close,m=r.total-q.total;
    const rank=m>=0?(inWin?3:2):1,c={g,sub,cls:q.cls,need:q.total,r,m,inWin,rank};
    if(!best||c.rank>best.rank||(c.rank===best.rank&&(c.rank===1?(c.inWin-best.inWin||c.m-best.m)>0:c.m>best.m)))best=c;});
   if(best){if(best.rank<3){const ins=l.res.filter(r=>r.date>=ev.open&&r.date<=ev.close).map(r=>{const q=tbl.find(t=>r.bw<=lim(t.cls));return q?{r,need:q.total,m:r.total-q.total}:null}).filter(Boolean).sort((x,y)=>y.m-x.m);best.inBest=ins[0]||null;}rows.push(best);}});
  rows.sort((x,y)=>y.rank-x.rank||y.m-x.m);
  return {age:tr.age,rows,top:rows[0]||null};}
 const CLOSE=10, grp=c=>c.g+(c.sub?' '+c.sub:'')+(c.g==='University'?' (if enrolled)':'');
 const code=c=>!c?'n':c.rank===3?'q':c.rank===2?'l':c.m>=-CLOSE?'c':'n';
 const short=m=>m.length>52?m.slice(0,50).trim()+'…':m;
 const hash=k=>{const m=location.hash.match(new RegExp(k+'=([^&]+)'));return m?decodeURIComponent(m[1]):null};
 const st={ev:hash('for')||store.get('for')||'',club:hash('club')||store.get('club')||'*',sex:'A',show:'list',q:''};
 if(!EVS.some(e=>e.id===st.ev))st.ev=(EVS.find(e=>daysTo(e.close)>=0)||EVS[0]||{}).id;
 const clubs=[...new Set(lifters.map(l=>l.club).filter(Boolean))].sort((a,b)=>tc(a).localeCompare(tc(b)));
 if(st.club!=='*'&&st.club!=='-'&&!clubs.includes(st.club))st.club='*';
 const cs=document.getElementById('rtClub');
 cs.innerHTML=`<option value="*">All PNW clubs</option>${clubs.map(c=>`<option value="${esc(c)}">${esc(tc(c))}</option>`).join('')}<option value="-">No club listed</option>`;cs.value=st.club;
 document.getElementById('rtEvent').innerHTML=EVS.map(e=>`<button type="button" data-k="${e.id}" aria-pressed="${e.id===st.ev}">${esc(e.name)}</button>`).join('');
 let rows=[],openId=null;
 const statusChip=c=>c.rank===3?`<span class="chip ok">Qualified · ${esc(grp(c))}</span>`:c.rank===2?`<span class="chip gold">Legacy total · ${esc(grp(c))}</span>`:`<span class="chip">${-c.m} kg short · ${esc(grp(c))}</span>`;
 const why=(c,ev)=>{const made=`${c.r.total} kg at ${c.r.bw} kg bodyweight on ${fmtD(c.r.date)}${c.r.meet?', '+esc(short(c.r.meet)):''}`;
  const inside=c.inBest?` Best inside the window so far: ${c.inBest.r.total} kg on ${fmtD(c.inBest.r.date)}, ${-c.inBest.m} kg short.`:FULL?' No total inside the window yet.':'';
  if(c.rank===3)return `${made}. Needed ${c.need} for the ${esc(c.cls)} class, so ${c.m?c.m+' kg over':'right on the total'}. Qualified, and may register in any class.`;
  if(c.rank===2)return c.r.date<ev.open?`${made}. That beats the ${c.need} needed for the ${esc(c.cls)} class, but it was made ${plural(Math.round((dOf(ev.open)-dOf(c.r.date))/864e5),'day')} before the window opened on ${fmtD(ev.open)}, so it doesn't count.${inside} A new total is needed by ${fmtD(ev.close)}.`:`${made}. That beats the ${c.need} needed for the ${esc(c.cls)} class, but it was made after the window closed.`;
  return `${made}. Needed ${c.need} for the ${esc(c.cls)} class.${c.inWin?'':' This total is also outside the window.'+inside}`;};
 function detail(l){const out=[];
  const body=EVS.map(e=>{const s=standing(e,l);if(!s.rows.length){out.push(e.name);return ''}
   return s.rows.map((c,i)=>`<tr><td>${i?'':esc(e.name)+`<div class="club">by ${fmtD(e.close)}</div>`}</td><td>${c.rank===3?'<span class="chip ok">Qualified</span>':c.rank===2?'<span class="chip gold">Legacy</span>':`<span class="chip">${-c.m} kg short</span>`}</td><td>${esc(grp(c))}<div class="club">${esc(c.cls)}</div></td><td class="kg">${c.need}</td><td class="kg">${c.r.total}<div class="club" style="font:400 12px var(--body)">${fmtD(c.r.date,false)}${c.inWin?'':' · outside window'}</div></td></tr>`).join('')}).join('');
  return `<div class="rt-detail"><div class="tscroll"><table><thead><tr><th>Event</th><th>Standing</th><th>Entering as</th><th class="num">Needs</th><th class="num">Best total</th></tr></thead><tbody>${body}</tbody></table></div>${out.length?`<p class="note">Outside the age groups for: ${out.map(esc).join(', ')}.</p>`:''}<div class="tscroll" style="margin-top:10px"><table><thead><tr><th>${FULL?'Every result since '+fmtD(RS.since):'Ranked results'}</th><th class="num">BW</th>${FULL?'<th class="num">Snatch</th><th class="num">C&amp;J</th>':''}<th class="num">Total</th></tr></thead><tbody>${l.res.slice().sort((a,b)=>a.date<b.date?1:-1).map(r=>`<tr><td>${fmtD(r.date)}${r.meet?`<div class="club">${esc(r.meet)}</div>`:''}</td><td class="num">${r.bw}</td>${FULL?`<td class="num">${r.sn||'—'}</td><td class="num">${r.cj||'—'}</td>`:''}<td class="kg">${r.total}</td></tr>`).join('')}</tbody></table></div></div>`;}
 function draw(){
  const ev=EVS.find(e=>e.id===st.ev);if(!ev)return;
  const pool=lifters.filter(l=>(st.club==='*'||(st.club==='-'?!l.club:l.club===st.club))&&(st.sex==='A'||l.sex===st.sex)&&(!st.q||l.name.toLowerCase().includes(st.q)));
  const all=pool.map(l=>{const s=standing(ev,l);return {l,s,c:s.top,k:code(s.top)}}).filter(x=>x.c);
  const n=k=>all.filter(x=>x.k===k).length,left=daysTo(ev.close);
  const card=(k,cls,label,v,d)=>`<button type="button" class="stat ${cls}" data-show="${k}" aria-pressed="${st.show===k}" title="Show these lifters"><span class="k">${label}</span><span class="v">${v}</span><span class="d">${d}</span></button>`;
  document.getElementById('rtStats').innerHTML=card('q','q','Qualified',n('q'),'total made inside the window')+card('l','l','Legacy total',n('l'),`big enough, but made before ${fmtD(ev.open)}`)+card('c','c',`Within ${CLOSE} kg`,n('c'),'of the total for their class')+`<div class="stat"><span class="k">Window closes</span><span class="v">${left<0?'Closed':plural(left,'day')}</span><span class="d">${fmtD(ev.close)} · <a href="planner.html#for=${ev.id}">see the meets left →</a></span></div>`;
  const want={list:['q','l'],q:['q'],l:['l'],c:['c'],all:['q','l','c','n']}[st.show];
  const ord={q:0,l:1,c:2,n:3};
  rows=all.filter(x=>want.includes(x.k)).sort((a,b)=>ord[a.k]-ord[b.k]||b.c.m-a.c.m||a.l.name.localeCompare(b.l.name));
  document.getElementById('rtHead').textContent=`${ev.name} · ${fmtRange(ev.start,ev.end)}, ${ev.where}`;
  document.getElementById('rtSub').textContent=`Totals count from ${fmtD(ev.open)} through ${fmtD(ev.close)}. ${plural(rows.length,'lifter')} shown${st.club==='*'?'':' from '+(st.club==='-'?'lifters with no club listed':tc(st.club))}.`;
  document.getElementById('rtList').innerHTML=rows.map(({l,s,c,k})=>`<li class="ag rt ${k}" data-id="${l.id}"><div class="dt"><b>${c.r.total}</b><span>kg</span></div><div><div class="ti">${prof(l.id,l.name)}</div><div class="su">${[l.club?esc(tc(l.club)):'',esc(c.cls),`age ${s.age} in ${dOf(ev.start).getFullYear()}`].filter(Boolean).join(' · ')}</div><div class="tg">${s.rows.filter((x,i)=>!i||x.rank>1).map(statusChip).join('')}</div><div class="su why">${why(c,ev)}</div></div><div class="act"><span class="away">${c.m>=0?'+'+c.m:c.m} kg</span><span class="links"><button type="button" data-more="${l.id}" aria-expanded="${openId===l.id}">${openId===l.id?'Hide events':'All events'}</button></span></div>${openId===l.id?detail(l):''}</li>`).join('')
   ||`<li class="empty" style="padding:8px 0">${all.length?'No lifters match this filter. Try “Everyone ranked”.':'No ranked lifters match.'}</li>`;
 }
 const save=()=>{store.set('for',st.ev);store.set('club',st.club);history.replaceState(null,'',`#for=${st.ev}${st.club!=='*'?'&club='+encodeURIComponent(st.club):''}`)};
 tabs('rtEvent',k=>{st.ev=k;save();draw()});tabs('rtSex',k=>{st.sex=k;draw()});tabs('rtShow',k=>{st.show=k;draw()});
 cs.addEventListener('change',()=>{st.club=cs.value;openId=null;save();draw()});
 document.getElementById('rtSearch').addEventListener('input',e=>{st.q=e.target.value.trim().toLowerCase();draw()});
 document.getElementById('rtList').addEventListener('click',e=>{const b=e.target.closest('[data-more]');if(!b)return;const id=+b.dataset.more;openId=openId===id?null:id;draw();});
 document.getElementById('rtCsv').addEventListener('click',()=>{const ev=EVS.find(e=>e.id===st.ev),q=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
  const lines=[['Event','Lifter','Club','Sex','Age in event year','Entering as','Class','Qualifying total','Best total','Bodyweight','Date made','Meet','Standing','Margin kg'],...rows.map(({l,s,c,k})=>[ev.name,l.name,tc(l.club),l.sex,s.age,grp(c),c.cls,c.need,c.r.total,c.r.bw,c.r.date,c.r.meet,{q:'Qualified',l:'Legacy total, needs a new one',c:'Within '+CLOSE+' kg',n:'Not yet'}[k],c.m])].map(r=>r.map(q).join(','));
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv'}));a.download=`pnw-${ev.id.toLowerCase()}-qualifying.csv`;document.body.appendChild(a);a.click();a.remove();});
 document.getElementById('rtPrint').addEventListener('click',()=>print());
 // the summary cards work like the Show buttons: tap one to list those lifters, tap it again to go back
 document.getElementById('rtStats').addEventListener('click',e=>{const b=e.target.closest('[data-show]');if(!b)return;const k=st.show===b.dataset.show?'list':b.dataset.show;document.querySelector(`#rtShow [data-k="${k}"]`).click();document.getElementById('rtHead').scrollIntoView({behavior:'smooth',block:'nearest'});});
 draw();rememberTabs();
}).catch(e=>{console.error(e);document.getElementById('rtList').innerHTML='<li class="empty">The rankings couldn\'t be loaded. Try again later.</li>';});
}
if(!has('plAgenda')&&!has('rtList'))rememberTabs();
}
// referees (Sport80's public Referees listing, refreshed daily)
if(has('refBody')){
 fetch('data/referees.json',{cache:'no-cache'}).then(r=>r.json()).then(R=>{
  const L=R.referees||[];setText('refCount',L.length&&R.updated?`${L.length} officials · updated ${new Date(R.updated+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`:'');
  document.getElementById('refBody').innerHTML=L.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.level||'')}${r.wso?'<sup class="est" title="Confirmed by the PNW WSO">*</sup>':''}</td><td>${esc(r.state||'')}</td></tr>`).join('')||`<tr><td colspan="3" class="empty">${R.updated?'No PNW officials found in USAW\'s listing.':'The list loads from USAW\'s referee listing with the next daily update.'}</td></tr>`;
 }).catch(()=>{document.getElementById('refBody').innerHTML='<tr><td colspan="3" class="empty">The referee list couldn\'t be loaded. Try again later.</td></tr>';});
}
if(document.querySelector('[data-needs="new-pages"]')){
 fetch('data/new-pages.json',{cache:'no-cache'}).then(r=>r.json()).then(render).catch(e=>{console.error(e);const m=document.querySelector('[data-needs="new-pages"]');if(m)m.insertAdjacentHTML('afterbegin','<p class="empty">This page\'s data couldn\'t be loaded. Try again later.</p>');});
}
})();
