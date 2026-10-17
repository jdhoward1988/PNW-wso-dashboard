// PNW WSO rankings fetch — run inside https://usaweightlifting.sport80.com/public/rankings/all
// (paste the whole file into the browser's JavaScript tool). It uses the page's own public
// API settings (window.env), so no token is stored in this repo.
//
// Result: { season, rows, clubs, length, chunks, hash, checksum } and the canonical JSON
// string is kept in window._pnwRankS. Read it back with:
//   window._pnwRankS.slice(i*CHUNK, (i+1)*CHUNK)   for i = 0 .. chunks-1   (CHUNK = 18000)
// scripts/rankings/assemble.py rebuilds data/rankings.json from those chunks and checks
// the length + hash, so a copying mistake can't reach the live site.
(async () => {
  const CHUNK = 18000;
  const WSO_PNW = 2;
  const season = new Date().getFullYear();
  // Current IWF Open classes, women first then men — this order is part of the file format.
  const CLASS_IDS = [942, 943, 944, 945, 946, 947, 948, 949, 934, 935, 936, 937, 938, 939, 940, 941];
  const D = window.env.RANKINGS_DOMAIN_URL;
  const h = { 'X-API-Token': window.env.SERVICES_API_PUBLIC_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' };

  const meta = await fetch(D + '/api/categories/rankings/table', { headers: h }).then(r => r.json());
  const items = meta.filters.find(f => f.name === 'weight_class').items;
  const label = id => {
    const it = items.find(x => x.value === id);
    if (!it || !/^Open (Women|Men)'s \d+\+?kg$/.test(it.text)) throw new Error('Weight class ' + id + ' changed: ' + (it && it.text));
    return it.text.replace('Open ', '');
  };

  const LV = { Local: 'L', National: 'N', International: 'I', 'North American Open Series': 'A' };
  const clubs = [];
  const ci = c => { c = typeof c === 'string' ? c.trim() : ''; if (!c) return -1; let i = clubs.indexOf(c); if (i < 0) { clubs.push(c); i = clubs.length - 1; } return i; };
  const classes = {};
  let rows = 0;
  for (const id of CLASS_IDS) {
    const name = label(id);
    let list = [];
    for (let p = 0; p < 30; p++) {
      const r = await fetch(D + `/api/categories/all/rankings/table/data?p=${p}&l=100&sort=&d=asc&s=&st=`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ date_range_start: `${season}-01-01`, date_range_end: `${season}-12-31`, wso: WSO_PNW, weight_class: id })
      }).then(r => r.json());
      list = list.concat(r.data || []);
      if (!r.next_page_url) break;
    }
    classes[name] = list.map(r => {
      const mid = +String((r.action && r.action[0] && r.action[0].route) || '').split('/').pop() || 0;
      return [r.rank, r.national_ranking, r.total, String(r.name || '').trim().replace(/\s+/g, ' '), (typeof r.club === 'string' ? r.club.trim() : ''),
        r.lifter_age, r.bodyweight, String(r.lift_date || '').slice(5).replace('-', ''), LV[r.level] || String(r.level || ''), mid];
    });
    // USAW returns tied lifters in varying order; sort ties by member id so unchanged data hashes the same
    classes[name].sort((a, b) => a[0] - b[0] || a[9] - b[9]);
    rows += list.length;
  }

  // Number clubs by first appearance only after sorting, so the club list is stable too
  for (const v of Object.values(classes)) for (const r of v) r[4] = ci(r[4]);

  const out = {
    season,
    source: `USA Weightlifting rankings (Sport80), WSO = Pacific Northwest, Jan 1 – Dec 31 ${season}, best total per lifter per Open weight class`,
    fields: ['pnwRank', 'usRank', 'total', 'name', 'club', 'age', 'bodyweight', 'liftDate(MMDD)', 'level', 'usawMemberId'],
    levels: { L: 'Local', N: 'National', I: 'International', A: 'North American Open Series' },
    clubs, classes
  };
  const s = JSON.stringify(out);
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  let totals = 0, ids = 0;
  for (const v of Object.values(classes)) for (const r of v) { totals += r[2]; ids += r[9]; }
  // keyHash ignores US rank, bodyweight, date and level (these shift without any new PNW result)
  const keyStr = JSON.stringify(Object.entries(classes).map(([k, v]) => [k, v.map(r => [r[0], r[2], r[3], r[4] >= 0 ? clubs[r[4]] : '', r[5], r[9]])]));
  let keyHash = 5381;
  for (let i = 0; i < keyStr.length; i++) keyHash = ((keyHash << 5) + keyHash + keyStr.charCodeAt(i)) >>> 0;
  window._pnwRankS = s;
  return { season, rows, clubs: clubs.length, keyHash, length: s.length, chunks: Math.ceil(s.length / CHUNK), hash, checksum: { totals, ids } };
})();
