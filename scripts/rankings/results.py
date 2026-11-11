#!/usr/bin/env python3
"""Save every meet result for PNW lifters, not just each lifter's best total of the season.

  python3 scripts/rankings/results.py          (run from the repo root after rankings.json is rebuilt; daily)
  python3 scripts/rankings/results.py --all    (re-read every lifter)

Writes data/results.json: for each lifter in data/rankings.json (and every lifter saved on an earlier
run, so last season's lifters stay in the file after the season rolls over) every result since
January 1 of last season: date, total, bodyweight, best snatch, best clean & jerk, the category
entered and the meet. It also stores each lifter's birth year (season minus the birth-year age USAW
shows in its rankings), so age groups for next year's events don't depend on a stored age.

Source: the public results table behind each lifter's USAW rankings profile
(usaweightlifting.sport80.com/public/rankings/member/<id>). The API address and public key are read
from USAW's rankings page on each run; nothing secret is stored here. USAW member numbers are never read or saved.

To keep the daily run small it re-reads only: lifters not saved yet, lifters whose ranked best isn't in
their saved results, lifters USAW's rankings show with a result in the last 45 days that isn't saved,
and one seventh of everyone else (so each lifter is fully re-read at least weekly).
Prints counts only: this repo and its Action logs are public. Standard library only.
"""
import datetime, json, pathlib, re, sys, time, urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
OUT = DATA / 'results.json'
RANK_PAGE = 'https://usaweightlifting.sport80.com/public/rankings/all'
UA = 'Mozilla/5.0 (compatible; pnw-wso-calendar-check; +https://github.com/Jdhoward1988/PNW-wso-dashboard)'
NOW = datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date()
WSO_PNW = 2
OPEN_CLASS_IDS = [942, 943, 944, 945, 946, 947, 948, 949, 934, 935, 936, 937, 938, 939, 940, 941]  # same as scripts/rankings/fetch.js
RECENT_DAYS = 45


def api_settings():
    req = urllib.request.Request(RANK_PAGE, headers={'User-Agent': UA})
    page = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
    m = re.search(r'window\.env\s*=\s*(\{.*?\});', page, flags=re.S)
    if not m: raise RuntimeError("USAW's rankings page no longer shows its API settings")
    env = json.loads(m[1])
    return env['RANKINGS_DOMAIN_URL'].rstrip('/'), env['SERVICES_API_PUBLIC_KEY']


def make_post(domain, token):
    headers = {'X-API-Token': token, 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA}
    def post(path, body):
        for attempt in range(3):
            try:
                req = urllib.request.Request(domain + path, data=json.dumps(body).encode(), headers=headers, method='POST')
                return json.load(urllib.request.urlopen(req, timeout=60))
            except Exception:
                if attempt == 2: raise
                time.sleep(2 + 3 * attempt)
    return post


def all_pages(post, path, body):
    rows, p = [], 0
    while p < 30:
        d = post(f'{path}?p={p}&l=100&sort=&d=asc&s=&st=', body)
        rows += d.get('data') or []
        if not d.get('next_page_url'): break
        p += 1
    return rows


def main():
    R = json.loads((DATA / 'rankings.json').read_text())
    season = R['season']
    since = f'{season - 1}-01-01'
    try:
        store = json.loads(OUT.read_text())
    except Exception:
        store = {}
    lifters = store.get('lifters', {})
    meets, cats = store.get('meets', []), store.get('categories', [])
    mi, ci = {m: i for i, m in enumerate(meets)}, {c: i for i, c in enumerate(cats)}
    def idx(table, lookup, name):
        if name not in lookup:
            lookup[name] = len(table); table.append(name)
        return lookup[name]

    # who is in the rankings now: name, sex, club, birth year, and their ranked bests
    ranked = {}
    def take(cls, x):
        l = ranked.setdefault(str(x[9]), {'n': x[3], 's': 'W' if cls.startswith('Women') else 'M',
                                          'c': R['clubs'][x[4]] if x[4] >= 0 else '', 'by': season - x[5], 'best': set()})
        l['best'].add((f"{season}-{x[7][:2]}-{x[7][2:]}", x[2]))
    for cls, xs in R['classes'].items():
        for x in xs: take(cls, x)
    for g in (R.get('youth') or {}).values():
        for cls, xs in g.items():
            for x in xs: take(cls, x)
    for k, r in ranked.items():
        l = lifters.setdefault(k, {'r': []})
        l.update(n=r['n'], s=r['s'], c=r['c'], by=r['by'])

    saved = lambda k: {(x[0], x[1]) for x in lifters[k]['r']}
    todo = set()
    if '--all' in sys.argv:
        todo = set(lifters)
    else:
        for k, l in lifters.items():
            if 'checked' not in l: todo.add(k)
            elif k in ranked and not ranked[k]['best'] <= saved(k): todo.add(k)
            elif int(k) % 7 == NOW.weekday(): todo.add(k)

    domain, token = api_settings()
    post = make_post(domain, token)
    status = {'checked': NOW.isoformat(), 'ok': False}
    recent_new = 0
    if '--all' not in sys.argv:
        try:
            start = (NOW - datetime.timedelta(days=RECENT_DAYS)).isoformat()
            for cid in OPEN_CLASS_IDS:
                for r in all_pages(post, '/api/categories/all/rankings/table/data',
                                   {'date_range_start': start, 'date_range_end': NOW.isoformat(), 'wso': WSO_PNW, 'weight_class': cid}):
                    k = str((r.get('action') or [{}])[0].get('route', '')).split('/')[-1]
                    if k in lifters and (r.get('lift_date'), r.get('total')) not in saved(k) and k not in todo:
                        todo.add(k); recent_new += 1
        except Exception as e:
            status['recentCheck'] = 'failed: ' + str(e)[:120]

    done = failed = 0
    for k in sorted(todo, key=int):
        try:
            rows = all_pages(post, f'/api/athletes/{int(k)}/table/data', {})
            res = []
            for r in rows:
                d, total = str(r.get('date') or ''), r.get('total') or 0
                if d < since or total <= 0: continue
                res.append([d, total, r.get('body_weight_(kg)') or 0, r.get('best_snatch') or 0, r.get('best_c&j') or 0,
                            idx(cats, ci, str(r.get('age_category') or '').strip()), idx(meets, mi, str(r.get('meet') or '').strip())])
            res.sort(key=lambda x: (x[0], x[1]))
            lifters[k]['r'] = res
            lifters[k]['checked'] = NOW.isoformat()
            done += 1
        except Exception:
            failed += 1
        time.sleep(0.12)

    # drop lifters who are no longer ranked and have nothing since last season
    for k in [k for k, l in lifters.items() if k not in ranked and not any(x[0] >= since for x in l['r'])]:
        del lifters[k]

    n_results = sum(len(l['r']) for l in lifters.values())
    status.update(ok=failed <= max(3, len(todo) // 10), lifters=len(lifters), results=n_results, reread=done, failed=failed, recentlyLifted=recent_new)
    if done or not OUT.exists():
        out = {'updated': NOW.isoformat(), 'season': season, 'since': since,
               'source': "USA Weightlifting rankings (Sport80): every result on each PNW lifter's public results table since " + since,
               'fields': ['date', 'total', 'bodyweight', 'bestSnatch', 'bestCleanAndJerk', 'category (index into categories)', 'meet (index into meets)'],
               'lifterFields': {'n': 'name', 's': 'W or M', 'c': 'club', 'by': 'birth year', 'checked': 'date last re-read', 'r': 'results'},
               'meets': meets, 'categories': cats,
               'lifters': dict(sorted(lifters.items(), key=lambda kv: int(kv[0])))}
        OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f"results: {len(lifters)} lifters, {n_results} results saved; re-read {done}, failed {failed}, new from the last {RECENT_DAYS} days {recent_new}")
    sp = DATA / 'cloud-status.json'
    try:
        st = json.loads(sp.read_text()); st['results'] = status; sp.write_text(json.dumps(st, indent=1) + '\n')
    except Exception:
        pass
    sys.exit(0 if status['ok'] else 1)


if __name__ == '__main__':
    main()
