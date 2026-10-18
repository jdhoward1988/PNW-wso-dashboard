// One-off probe: capture the Sport80 widget data request/response shape
import { chromium } from 'playwright';
const out = {};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const w of [1, 2, 3]) {
  const cap = { reqs: [], resps: [] };
  const onReq = r => { if (/widget\/data/.test(r.url())) cap.reqs.push({ url: r.url(), method: r.method(), headers: Object.keys(r.headers()), hasToken: Object.keys(r.headers()).filter(k => /token|auth|key/i.test(k)), body: r.postData() }); };
  const onResp = async r => { if (/widget\/data/.test(r.url())) { try { const j = await r.json(); cap.resps.push({ keys: Object.keys(j), sample: JSON.stringify(j).slice(0, 3000) }); } catch (e) { } } };
  page.on('request', onReq); page.on('response', onResp);
  await page.goto(`https://usaweightlifting.sport80.com/public/widget/${w}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  page.off('request', onReq); page.off('response', onResp);
  out['widget' + w] = cap;
}
out.envKeys = await page.evaluate(() => Object.keys(window.env || {}));
await browser.close();
console.log(JSON.stringify(out, null, 1));
