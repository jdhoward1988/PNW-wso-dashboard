// One-off: is Sport80 event 15044 (Level 1 Anchorage, Nov 14-15 2026) still live?
import { chromium } from 'playwright';
const out = {};
const b = await chromium.launch(); const pg = await b.newPage();
const api = [];
pg.on('response', async r => { if (/\/api\//.test(r.url())) { try { api.push({ url: r.url().split('?')[0], status: r.status(), body: (await r.text()).slice(0, 1500) }); } catch {} } });
await pg.goto('https://usaweightlifting.sport80.com/public/wizard/e/15044', { waitUntil: 'networkidle', timeout: 90000 }).catch(e => out.gotoError = String(e));
await pg.waitForTimeout(4000);
out.finalUrl = pg.url();
out.text = (await pg.evaluate(() => document.body.innerText)).slice(0, 3000);
out.api = api.slice(0, 12);
// widget 2 search, including events from earlier dates
await pg.goto('https://usaweightlifting.sport80.com/public/widget/2', { waitUntil: 'networkidle', timeout: 90000 });
out.search = await pg.evaluate(async () => {
  const res = {};
  for (const from of ['2026-10-01', '2026-11-04']) {
    const fd = new FormData(); fd.append('event_from_date', from);
    const r = await fetch('/api/public/widget/data/new/2?p=0&i=50&s=Anchorage&l=&d=&f=', { method: 'POST', body: fd, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
    const j = await r.json(); res[from] = (j.data || []).map(e => ({ id: e.id, name: e.name, subtitle: e.subtitle, address: e.address, actions: e.actions }));
  }
  return res;
});
await b.close();
console.log(JSON.stringify(out, null, 1));
