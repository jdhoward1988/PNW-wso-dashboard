// PNW WSO rankings fetch — run inside https://usaweightlifting.sport80.com/public/rankings/all
// (paste the whole file into the browser's JavaScript tool, prefixed with "await "). It uses the
// page's own public API settings (window.env), so no token is stored in this repo.
//
// Pulls, for the current year and WSO = Pacific Northwest:
//   classes — the 16 current Open weight classes (all ages)
//   youth   — every active USAW youth age-group weight class (16-17, 14-15, 13 Under, 11 Under …),
//             found from USAW's own labels, e.g. "Women's 16-17 Age Group 48kg". Youth classes
//             differ from Open, so the page switches weight classes when Youth is picked.
//
// Result: { season, rows, youthGroups, youthClasses, clubs, keyHash, length, chunks, hash, checksum }
// and the canonical JSON string is kept in window._pnwRankS. await window._pnwMemberIds([...hashes])
// takes SHA-256 hashes of USAW member numbers (as the opt-in web app returns them) and gives
// {hash: profileId|null} for adaptive matching. Member numbers are never saved. Read the JSON back with:
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

  // Youth age-group classes: active (not "(Inactive)") labels like
  // "Women's 16-17 Age Group 48kg", "Men's 13 Under Age Group +73kg" or "… 95+kg"
  const YOUTH_RE = /^(Women|Men)'s (\d+-\d+|\d+ Under) Age Group \+?(\d+)(\+?) ?kg$/i;
  const youthItems = items
    .filter(x => !/inactive/i.test(x.text))
    .map(x => {
      const m = String(x.text).trim().match(YOUTH_RE);
      if (!m) return null;
      return { id: x.value, group: m[2].replace(/\s+/g, ' '), gender: m[1].toLowerCase() === 'women' ? 'Women' : 'Men', kg: +m[3], plus: x.text.includes('+') };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // groups oldest first (16-17, 14-15, 13 Under, 11 Under), then Women before Men, then weight (+ last)
      const ga = parseInt(a.group, 10), gb = parseInt(b.group, 10);
      return gb - ga || (a.gender === b.gender ? 0 : a.gender === 'Women' ? -1 : 1) || a.kg - b.kg || (a.plus - b.plus);
    });
  if (!youthItems.length) throw new Error('No youth age-group weight classes found; USAW labels changed');

  const LV = { Local: 'L', National: 'N', International: 'I', 'North American Open Series': 'A' };
  const toRow = r => {
    const mid = +String((r.action && r.action[0] && r.action[0].route) || '').split('/').pop() || 0;
    return [r.rank, r.national_ranking, r.total, String(r.name || '').trim().replace(/\s+/g, ' '), (typeof r.club === 'string' ? r.club.trim() : ''),
      r.lifter_age, r.bodyweight, String(r.lift_date || '').slice(5).replace('-', ''), LV[r.level] || String(r.level || ''), mid];
  };
  // USAW member number -> rankings profile id, for matching adaptive opt-ins. Kept only in
  // the page (window._pnwMemberIds); never written to data/rankings.json.
  const memberIds = {};
  const pull = async id => {
    let list = [];
    for (let p = 0; p < 30; p++) {
      const r = await fetch(D + `/api/categories/all/rankings/table/data?p=${p}&l=100&sort=&d=asc&s=&st=`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ date_range_start: `${season}-01-01`, date_range_end: `${season}-12-31`, wso: WSO_PNW, weight_class: id })
      }).then(r => r.json());
      list = list.concat(r.data || []);
      if (!r.next_page_url) break;
    }
    for (const r of list) {
      const num = String(r.membership || '').replace(/\D/g, '');
      const mid = +String((r.action && r.action[0] && r.action[0].route) || '').split('/').pop() || 0;
      if (num && mid) memberIds[num] = mid;
    }
    // USAW returns tied lifters in varying order; sort ties by member id so unchanged data hashes the same
    return list.map(toRow).sort((a, b) => a[0] - b[0] || a[9] - b[9]);
  };

  let rows = 0;
  const classes = {};
  for (const id of CLASS_IDS) { const k = label(id); classes[k] = await pull(id); rows += classes[k].length; }

  const youth = {};
  for (const y of youthItems) {
    const cls = `${y.gender}'s ${y.kg}${y.plus ? '+' : ''}kg`;
    (youth[y.group] = youth[y.group] || {})[cls] = await pull(y.id);
    rows += youth[y.group][cls].length;
  }

  // Number clubs by first appearance only after sorting, so the club list is stable too
  const clubs = [];
  const ci = c => { if (!c) return -1; let i = clubs.indexOf(c); if (i < 0) { clubs.push(c); i = clubs.length - 1; } return i; };
  const allLists = [...Object.values(classes), ...Object.values(youth).flatMap(g => Object.values(g))];
  for (const v of allLists) for (const r of v) r[4] = ci(r[4]);

  const out = {
    season,
    source: `USA Weightlifting rankings (Sport80), WSO = Pacific Northwest, Jan 1 – Dec 31 ${season}, best total per lifter per weight class (Open classes, and youth age-group classes)`,
    fields: ['pnwRank', 'usRank', 'total', 'name', 'club', 'age', 'bodyweight', 'liftDate(MMDD)', 'level', 'usawMemberId'],
    levels: { L: 'Local', N: 'National', I: 'International', A: 'North American Open Series' },
    clubs, classes, youth
  };
  const s = JSON.stringify(out);
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  let totals = 0, ids = 0;
  for (const v of allLists) for (const r of v) { totals += r[2]; ids += r[9]; }
  // keyHash ignores US rank, bodyweight, date and level (these shift without any new PNW result)
  const keyed = [...Object.entries(classes), ...Object.entries(youth).flatMap(([g, cl]) => Object.entries(cl).map(([k, v]) => [g + ' ' + k, v]))];
  const keyStr = JSON.stringify(keyed.map(([k, v]) => [k, v.map(r => [r[0], r[2], r[3], r[4] >= 0 ? clubs[r[4]] : '', r[5], r[9]])]));
  let keyHash = 5381;
  for (let i = 0; i < keyStr.length; i++) keyHash = ((keyHash << 5) + keyHash + keyStr.charCodeAt(i)) >>> 0;
  window._pnwRankS = s;
  // Profile ids for hashed USAW member numbers: await window._pnwMemberIds(["<sha256 hex>", ...])
  window._pnwMemberIds = async hashes => {
    const hex = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const byHash = {};
    for (const [num, mid] of Object.entries(memberIds)) byHash[await hex(num)] = mid;
    return Object.fromEntries((hashes || []).map(x => [String(x).toLowerCase(), byHash[String(x).toLowerCase()] || null]));
  };
  return {
    season, rows, youthGroups: Object.keys(youth), youthClasses: youthItems.length, clubs: clubs.length,
    keyHash, length: s.length, chunks: Math.ceil(s.length / CHUNK), hash, checksum: { totals, ids }
  };
})();
