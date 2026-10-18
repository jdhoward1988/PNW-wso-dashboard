// One-off connectivity probe: can GitHub's runners load Sport80 and the opt-in web app?
import { chromium } from 'playwright';
const out = {};
const browser = await chromium.launch();
const page = await browser.newPage();
const apis = new Set();
page.on('request', r => { const u = r.url(); if (/api/.test(u) && !/google|sentry|analytics/.test(u)) apis.add(r.method() + ' ' + u.split('?')[0]); });
try {
  await page.goto('https://usaweightlifting.sport80.com/public/rankings/all', { waitUntil: 'networkidle', timeout: 60000 });
  out.rankingsEnv = await page.evaluate(() => !!(window.env && window.env.RANKINGS_DOMAIN_URL));
  out.rankingsApi = await page.evaluate(async () => {
    const D = window.env.RANKINGS_DOMAIN_URL, h = { 'X-API-Token': window.env.SERVICES_API_PUBLIC_KEY, 'Content-Type': 'application/json', Accept: 'application/json' };
    const r = await fetch(D + '/api/categories/all/rankings/table/data?p=0&l=100&sort=&d=asc&s=&st=', { method: 'POST', headers: h, body: JSON.stringify({ date_range_start: '2026-01-01', date_range_end: '2026-12-31', wso: 2, weight_class: 942 }) });
    const j = await r.json(); return { status: r.status, rows: (j.data || []).length };
  });
} catch (e) { out.rankingsError = String(e).slice(0, 300); }
for (const w of [1, 2, 3]) {
  try {
    apis.clear();
    await page.goto(`https://usaweightlifting.sport80.com/public/widget/${w}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    out['widget' + w] = { url: page.url(), apis: [...apis], text: (await page.evaluate(() => document.body.innerText)).slice(0, 2500) };
  } catch (e) { out['widget' + w] = { error: String(e).slice(0, 300) }; }
}
try {
  const r = await fetch('https://script.google.com/macros/s/AKfycbwOrPJiVvfyg1ZWkoHFLLiepIWCh4pfAzxQKSr44YzuxNYqSQNwypkqnqvNI_1jUM2eiA/exec', { redirect: 'follow' });
  const t = await r.text(); out.webapp = { status: r.status, json: t.trim().startsWith('{'), count: t.trim().startsWith('{') ? JSON.parse(t).athletes.length : null };
} catch (e) { out.webapp = { error: String(e).slice(0, 300) }; }
await browser.close();
console.log(JSON.stringify(out, null, 1));
