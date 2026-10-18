// PNW WSO cloud job (GitHub Actions): reads Sport80 in a headless browser so the daily
// Claude update doesn't need anyone's laptop.
//
//   node scripts/cloud/sport80.mjs [--rankings]
//
// Every run:  data/sport80-events.json  — in-person Meets / Courses / Camps & Speaker Series
//             in Alaska, Oregon or Washington from Sport80's public widgets 1, 2, 3.
// --rankings (Wednesdays): runs scripts/rankings/fetch.js on the USAW rankings page, rebuilds
//             data/rankings.json through assemble.py (same length + hash check), then refreshes
//             data/adaptive.json from the approved opt-in list (sync.py, matched by hashed
//             USAW membership number).
// Always writes data/cloud-status.json (no athlete names; this repo and its logs are public).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://usaweightlifting.sport80.com';
const WEBAPP = JSON.parse(readFileSync('data/adaptive.json', 'utf8')).approvedSource;
const STATES = { Alaska: 'AK', Oregon: 'OR', Washington: 'WA' };
const LISTS = { 1: 'meets', 2: 'courses', 3: 'camps' };
const doRankings = process.argv.includes('--rankings');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const status = { checked: today, events: null, rankings: doRankings ? null : 'not scheduled today', adaptive: doRankings ? null : 'not scheduled today' };

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', env: { ...process.env, PNW_NO_NAMES: '1' } }).trim();
const iso = s => { const m = String(s || '').match(/(\d\d)\/(\d\d)\/(\d{4})/); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };

const browser = await chromium.launch();
const page = await browser.newPage();
let failed = false;

// ---- 1. Events (every day) ----
try {
  await page.goto(`${BASE}/public/widget/1`, { waitUntil: 'networkidle', timeout: 90000 });
  const lists = {};
  for (const [w, key] of Object.entries(LISTS)) {
    const items = await page.evaluate(async ({ w, today }) => {
      let all = [];
      for (let p = 0; p < 20; p++) {
        const fd = new FormData(); fd.append('event_from_date', today);
        const r = await fetch(`/api/public/widget/data/new/${w}?p=${p}&i=50&s=&l=&d=&f=`, {
          method: 'POST', body: fd, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!r.ok) throw new Error(`widget ${w} page ${p}: HTTP ${r.status}`);
        const j = await r.json();
        all = all.concat(j.data || []);
        if (!j.next_page_url) break;
      }
      return all;
    }, { w, today });
    lists[key] = items.map(e => {
      const parts = String(e.address || '').split(',').map(s => s.trim());
      const si = parts.findIndex(p => STATES[p]);
      if (si < 0) return null; // not in AK/OR/WA (or online / no address)
      const [start, end] = String(e.subtitle || '').split(' - ').map(iso);
      return {
        id: +e.id, name: String(e.name || '').trim(), start, end: end || start,
        city: si > 0 ? parts[si - 1] : '', state: STATES[parts[si]], address: parts.slice(0, si + 1).join(', '),
        type: ((e.info || []).find(i => /Type$/.test(i.title)) || {}).value || '',
        url: `${BASE}/public/widget/${w}`, entryUrl: ((e.actions || [])[0] || {}).url || null
      };
    }).filter(Boolean).sort((a, b) => (a.start || '').localeCompare(b.start || '') || a.id - b.id);
    console.log(`widget ${w} (${key}): ${items.length} upcoming nationwide, ${lists[key].length} in AK/OR/WA`);
  }
  const file = 'data/sport80-events.json';
  let old = null; try { old = JSON.parse(readFileSync(file, 'utf8')); } catch { }
  const changed = !old || JSON.stringify(old.lists) !== JSON.stringify(lists);
  writeFileSync(file, JSON.stringify({
    source: 'Sport80 public widgets (1 = Meets, 2 = Courses, 3 = Camps/Speaker Series), upcoming events located in Alaska, Oregon or Washington',
    updated: changed ? today : old.updated, lists
  }, null, 1) + '\n');
  status.events = { ok: true, changed, counts: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])) };
} catch (e) {
  failed = true; status.events = { ok: false, error: String(e.message || e).slice(0, 300) };
  console.error('EVENTS FAILED:', e);
}

// ---- 2. Rankings + adaptive (Wednesdays) ----
if (doRankings) {
  const dir = mkdtempSync(join(tmpdir(), 'pnw-'));
  let rankPageOk = false;
  try {
    await page.goto(`${BASE}/public/rankings/all`, { waitUntil: 'networkidle', timeout: 90000 });
    const src = readFileSync('scripts/rankings/fetch.js', 'utf8').trim().replace(/;$/, '');
    const res = await page.evaluate(`(async () => {\n return await ${src}\n})()`);
    rankPageOk = true;
    const check = run('python3', ['scripts/rankings/assemble.py', 'check', String(res.keyHash), String(res.season)]);
    const s = await page.evaluate(() => window._pnwRankS);
    writeFileSync(join(dir, 'rank.txt'), s, 'utf8');
    const out = run('python3', ['scripts/rankings/assemble.py', 'build', String(res.hash), String(res.length), join(dir, 'rank.txt')]);
    console.log(check, '|', out);
    status.rankings = { ok: true, pnwChanged: check === 'CHANGED', result: out };
  } catch (e) {
    failed = true;
    const msg = String((e.stderr || '') + (e.message || e)).slice(0, 400);
    status.rankings = { ok: /REFUSING/.test(msg), error: msg };
    console.error('RANKINGS:', msg);
    try { run('git', ['checkout', 'data/rankings.json']); } catch { }
  }
  try {
    if (!rankPageOk) throw new Error('rankings page unavailable; adaptive list left unchanged');
    const r = await fetch(WEBAPP, { redirect: 'follow' });
    const approved = await r.json();
    if (!Array.isArray(approved.athletes)) throw new Error('approved list: unexpected response');
    const hashes = approved.athletes.map(a => a.member).filter(Boolean);
    const members = await page.evaluate(h => window._pnwMemberIds(h), hashes);
    writeFileSync(join(dir, 'approved.json'), JSON.stringify(approved));
    writeFileSync(join(dir, 'members.json'), JSON.stringify(members));
    const out = run('python3', ['scripts/adaptive/sync.py', join(dir, 'approved.json'), join(dir, 'members.json')]);
    console.log(out);
    const listed = (out.match(/(\d+) adaptive athletes listed/) || [])[1];
    status.adaptive = {
      ok: true, approved: approved.athletes.length, listed: listed ? +listed : null,
      unmatched: (out.match(/^UNMATCHED/gm) || []).length, notRankedYet: (out.match(/no PNW ranked result/g) || []).length
    };
  } catch (e) {
    failed = true; status.adaptive = { ok: false, error: String(e.message || e).slice(0, 300) };
    console.error('ADAPTIVE:', e.message || e);
    try { run('git', ['checkout', 'data/adaptive.json']); } catch { }
  }
}

await browser.close();
writeFileSync('data/cloud-status.json', JSON.stringify(status, null, 1) + '\n');
console.log(JSON.stringify(status));
if (failed) process.exitCode = 1; // GitHub emails the repo owner about failed scheduled runs
