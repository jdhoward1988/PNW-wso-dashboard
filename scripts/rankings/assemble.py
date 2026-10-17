#!/usr/bin/env python3
"""Rebuild data/rankings.json from the browser fetch (scripts/rankings/fetch.js).

  python3 scripts/rankings/assemble.py check KEYHASH SEASON
      -> prints SAME if data/rankings.json already has the same PNW ranks, totals, names,
         clubs and ages for this season (US rank / bodyweight / date may differ), else CHANGED.
  python3 scripts/rankings/assemble.py build HASH LENGTH chunk0.txt chunk1.txt ...
      -> joins the chunk files, verifies LENGTH and HASH, writes data/rankings.json
         with today's date (Pacific) as "updated". Exits 1 on any mismatch.
  python3 scripts/rankings/assemble.py touch
      -> only sets "updated" to today (data checked, nothing new).

HASH is djb2 over the UTF-16 code units of the canonical JSON string (same as fetch.js).
"""
import json, sys, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'data' / 'rankings.json'
KEYS = ['season', 'source', 'fields', 'levels', 'clubs', 'classes', 'youth']


def djb2(s):
    h = 5381
    b = s.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h = (h * 33 + (b[i] | (b[i + 1] << 8))) & 0xFFFFFFFF
    return h


def lists(obj):
    return list(obj['classes'].values()) + [v for g in obj.get('youth', {}).values() for v in g.values()]


def normalize(obj):
    # Same tie order as fetch.js: rank, then USAW member id
    old = obj['clubs']
    obj.setdefault('youth', {})
    for v in lists(obj):
        v.sort(key=lambda r: (r[0], r[9]))
    clubs = []
    for v in lists(obj):
        for r in v:
            name = old[r[4]] if r[4] >= 0 else ''
            if name and name not in clubs:
                clubs.append(name)
            r[4] = clubs.index(name) if name else -1
    obj['clubs'] = clubs
    return obj


def canonical(obj):
    obj = dict(obj); obj.setdefault('youth', {})
    return json.dumps({k: obj[k] for k in KEYS}, separators=(',', ':'), ensure_ascii=False)


def key_hash(obj):
    clubs = obj['clubs']
    items = list(obj['classes'].items()) + [(g + ' ' + k, v) for g, cl in obj.get('youth', {}).items() for k, v in cl.items()]
    rows = [[k, [[r[0], r[2], r[3], clubs[r[4]] if r[4] >= 0 else '', r[5], r[9]] for r in v]]
            for k, v in items]
    return djb2(json.dumps(rows, separators=(',', ':'), ensure_ascii=False))


def today():
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date().isoformat()
    except Exception:
        return datetime.date.today().isoformat()


def write(obj):
    out = {'season': obj['season'], 'updated': today()}
    out.update({k: obj.get(k, {}) for k in KEYS if k != 'season'})
    DATA.write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'check':
        cur = normalize(json.loads(DATA.read_text()))
        season = int(sys.argv[3]) if len(sys.argv) > 3 else cur.get('season')
        if cur.get('season') != season:
            print('CHANGED')  # new season
        else:
            print('SAME' if key_hash(cur) == int(sys.argv[2]) else 'CHANGED')
    elif cmd == 'build':
        want_hash, want_len = int(sys.argv[2]), int(sys.argv[3])
        s = ''.join(pathlib.Path(p).read_text(encoding='utf-8').rstrip('\n') for p in sys.argv[4:])
        if len(s.encode('utf-16-le')) // 2 != want_len:
            sys.exit(f'LENGTH MISMATCH: got {len(s)}, expected {want_len}')
        if djb2(s) != want_hash:
            sys.exit(f'HASH MISMATCH: got {djb2(s)}, expected {want_hash}')
        obj = json.loads(s)
        n = sum(len(v) for v in obj['classes'].values())
        ny = sum(len(v) for g in obj.get('youth', {}).values() for v in g.values())
        if n == 0:
            sys.exit('REFUSING: no results returned (e.g. early in a new season); keeping the current file')
        write(obj)
        print(f'OK: {n} Open results + {ny} youth results in {len(obj.get("youth", {}))} age groups, {len(obj["clubs"])} clubs, season {obj["season"]}')
    elif cmd == 'touch':
        cur = json.loads(DATA.read_text())
        write(cur)
        print('OK: updated date set to', today())
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
