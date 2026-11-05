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
function render(D){
document.querySelectorAll('.sbSeason').forEach(e=>e.textContent=D.season);
setText('pgUpdated','Updated '+new Date(D.updated+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));
if(has('qtTable')){
// qualifying totals
(function(){
 const Q=D.qt, EV=Q?Object.fromEntries(Q.events.map(e=>[e.key,e.name])):{};
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
  tbl.innerHTML=`<thead><tr><th>Class</th>${evs.map(e=>`<th class="num">${esc(EV[e]||e)}</th>`).join('')}</tr></thead><tbody>${classes.map(c=>`<tr><td class="wcls">${esc(c)}</td>${evs.map(e=>`<td class="kg">${val(c,e)}</td>`).join('')}</tr>`).join('')||'<tr><td class="empty">No totals for this group.</td></tr>'}</tbody>`;
  document.getElementById('qtEvents').innerHTML=Q.events.filter(e=>evs.includes(e.key)).map(e=>`<p class="note" style="margin:6px 0 0"><b>${esc(e.name)}</b> · ${esc(e.where)} · ${esc(e.dates)} · qualifying window ${esc(e.window)}</p>`).join('')+(rows.some(r=>r.event==='VWF')&&st.age==='Masters'&&st.sub==='90+'&&st.sex==='M'?'<p class="note" style="margin:6px 0 0">USAW\'s 2027 table has no Finals total for Masters 90+ men\'s 60 kg.</p>':'');
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
