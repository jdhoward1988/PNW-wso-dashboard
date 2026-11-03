"""Build data/new-pages.json for the PNW WSO draft pages, and data/history/<season>.json for Most Improved.

  python3 scripts/features/build.py            (run from the repo root; the cloud job runs it daily)

Inputs: data/rankings.json, data/adaptive.json, data/adaptive-results.json, data/qualifying-2027.json,
scripts/features/qyouth_factors.json. Prints counts only: this repo and its Action logs are public.

Best lifter: Q-points (Huebner et al. 2023), the metric USAW uses for Best Lifter at national events.
Masters: Q-Masters = Q-points x age factor (values read from Huebner's Q-points calculator, 2024-09-24 update).
Team scoring: IWF TCRR 6.8.3 place points (28, 25, 23, 22, 21, 20 ... 1 for places 1-25), as used by
USAW national events and the USAW Club League (top 5 men and top 5 women per club score).
The rankings feed carries totals only, so places are scored on the total (TCRR also scores snatch and C&J).
"""
import json, sys, collections, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, 'data')
src = os.path.join(DATA, 'rankings.json')
out_path = os.path.join(DATA, 'new-pages.json')
# Q-Youth factors sampled from Huebner's official Q-Youth calculator (huebner.shinyapps.io/Qyouth):
# {sex: {age: [factor at 20 kg, 21 kg, ... 160 kg]}}, ages 10-20. Q-Youth = total x factor.
QY = json.load(open(os.path.join(HERE, 'qyouth_factors.json')))
d = json.load(open(src))
C = d['clubs']

QMF = {  # Q-Masters age factors, ages 30-80
 'M': {30:1,31:1.01,32:1.018,33:1.026,34:1.038,35:1.052,36:1.064,37:1.076,38:1.088,39:1.1,40:1.112,41:1.124,42:1.136,43:1.148,44:1.16,45:1.173,46:1.187,47:1.201,48:1.215,49:1.23,50:1.247,51:1.264,52:1.283,53:1.304,54:1.327,55:1.351,56:1.376,57:1.401,58:1.425,59:1.451,60:1.477,61:1.504,62:1.531,63:1.56,64:1.589,65:1.62,66:1.654,67:1.693,68:1.736,69:1.784,70:1.833,71:1.883,72:1.932,73:1.981,74:2.031,75:2.083,76:2.139,77:2.202,78:2.271,79:2.348,80:2.43},
 'W': {30:1,31:1.01,32:1.021,33:1.031,34:1.042,35:1.052,36:1.063,37:1.073,38:1.084,39:1.096,40:1.108,41:1.122,42:1.138,43:1.155,44:1.173,45:1.194,46:1.216,47:1.24,48:1.265,49:1.292,50:1.321,51:1.352,52:1.384,53:1.419,54:1.456,55:1.494,56:1.534,57:1.575,58:1.617,59:1.66,60:1.704,61:1.748,62:1.794,63:1.841,64:1.89,65:1.942,66:1.996,67:2.052,68:2.109,69:2.168,70:2.226,71:2.285,72:2.343,73:2.402,74:2.464,75:2.528,76:2.597,77:2.67,78:2.749,79:2.831,80:2.918},
}
TEAM_PTS = [28, 25, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
NEW_CLASSES = '0801'  # IWF/USAW bodyweight categories changed Aug 1, 2026

def qpts(total, bw, sex):
    b = bw / 100
    if sex == 'M':
        return total * 463.26 / (416.7 - 47.87 * b ** -2 + 18.93 * b ** 2)
    return total * 306.54 / (266.5 - 19.44 * b ** -2 + 18.61 * b ** 2)

def qmasters(q, age, sex):
    if age < 30: return q
    return q * QMF[sex][min(age, 80)]

def qyouth(total, bw, age, sex):
    """(score, estimated). Under 10 uses the age-10 factors (youngest in the calculator) and is flagged.
    None over 20."""
    est = age < 10
    t = QY['Male' if sex == 'M' else 'Female'].get(str(max(age, 10)))
    if not t: return None
    x = min(max(bw, 20), 160) - 20
    i = min(int(x), len(t) - 2)
    f = t[i] + (t[i + 1] - t[i]) * (x - i)  # straight line between whole-kg samples
    return total * f, est

def sex_of(cls): return 'W' if cls.startswith('Women') else 'M'

rows = [(cls, x) for cls, v in d['classes'].items() for x in v]

def lifter_entries(rs):
    best = {}
    for cls, x in rs:
        sx = sex_of(cls)
        q = qpts(x[2], x[6], sx)
        e = {'q': round(q, 2), 'qm': round(qmasters(q, x[5], sx), 2), 'name': x[3], 'club': C[x[4]] if x[4] >= 0 else '',
             'age': x[5], 'cls': cls, 'total': x[2], 'bw': x[6], 'sex': sx, 'id': x[9], 'date': x[7], 'lvl': x[8], 'us': x[1]}
        if x[9] not in best or e['q'] > best[x[9]]['q']:
            best[x[9]] = e
    return list(best.values())

L = lifter_entries(rows)
out = {'updated': d['updated'], 'season': d['season']}

# ---- season bests: best total per class, filtered like the rankings page ----
def sb(x): return [x[2], x[3], C[x[4]] if x[4] >= 0 else '', x[5], x[7], x[9], x[8], x[6]]
AGES = {'all': lambda a: True, 'junior': lambda a: 15 <= a <= 20, 'masters': lambda a: a >= 35}
bests = {k: {} for k in AGES}
for cls, rs in d['classes'].items():
    for k, f in AGES.items():
        r = [x for x in rs if f(x[5])]
        bests[k][cls] = sb(max(r, key=lambda x: (x[2], -x[6]))) if r else None
bests['youth'] = {g: {cls: (sb(r[0]) if r else None) for cls, r in cl.items()} for g, cl in d['youth'].items()}
out['bests'] = bests

# ---- awards: Youth by Q-Youth; Junior and Senior by Q-points; Masters by Q-Masters ----
youth_best, youth_skipped = {}, set()
for g, cl in d['youth'].items():
    for cls, xs in cl.items():
        sx = sex_of(cls)
        for x in xs:
            r = qyouth(x[2], x[6], x[5], sx)
            if r is None: youth_skipped.add(x[9]); continue
            qy, est = r
            e = {'qy': round(qy, 2), 'est': est, 'q': round(qpts(x[2], x[6], sx), 2), 'name': x[3], 'club': C[x[4]] if x[4] >= 0 else '',
                 'age': x[5], 'cls': g + ' ' + cls, 'total': x[2], 'bw': x[6], 'sex': sx, 'id': x[9], 'date': x[7]}
            if x[9] not in youth_best or e['qy'] > youth_best[x[9]]['qy']: youth_best[x[9]] = e
YL = list(youth_best.values())
aw = {}
for sx in 'WM':
    aw[sx + 'Youth'] = sorted([l for l in YL if l['sex'] == sx], key=lambda l: -l['qy'])[:3]
    for cat, f, key in [('Junior', lambda a: 15 <= a <= 20, 'q'), ('Senior', lambda a: 21 <= a <= 34, 'q'), ('Masters', lambda a: a >= 35, 'qm')]:
        aw[sx + cat] = sorted([l for l in L if l['sex'] == sx and f(l['age'])], key=lambda l: -l[key])[:3]
out['awards'] = aw
out['youthSkipped'] = len(youth_skipped - set(youth_best))
out['overall'] = {s: sorted([l for l in L if l['sex'] == s], key=lambda l: -l['q'])[:10] for s in 'WM'}
out['youthOverall'] = {s: sorted([l for l in YL if l['sex'] == s], key=lambda l: -l['qy']) for s in 'WM'}  # every youth lifter, so under-10s always show

# ---- season archive for Most Improved (data/history/<season>.json in the repo) ----
hist = {}
for l in L:
    hist[str(l['id'])] = {'name': l['name'], 'sex': l['sex'], 'age': l['age'], 'club': l['club'], 'cls': l['cls'],
                          'total': l['total'], 'bw': l['bw'], 'q': l['q'], 'qm': l['qm']}
for l in YL:
    h = hist.setdefault(str(l['id']), {'name': l['name'], 'sex': l['sex'], 'age': l['age'], 'club': l['club'], 'cls': l['cls'],
                                        'total': l['total'], 'bw': l['bw'], 'q': l['q'], 'qm': l['q']})
    h['qy'] = l['qy']; h['qyEst'] = l['est']; h['ycls'] = l['cls']; h['ytotal'] = l['total']; h['ybw'] = l['bw']
archive = {'season': d['season'], 'updated': d['updated'],
           'note': "Each PNW lifter's best result of the season: Q-points (q), Q-Masters (qm, = q under 30) and, for lifters 10-20 in youth classes, Q-Youth (qy). Keyed by USAW rankings profile id. Used next season for Most Improved.",
           'lifters': dict(sorted(hist.items(), key=lambda kv: int(kv[0])))}
os.makedirs(os.path.join(DATA, 'history'), exist_ok=True)
with open(os.path.join(DATA, 'history', f"{d['season']}.json"), 'w') as f:
    json.dump(archive, f, separators=(',', ':'))
out['archive'] = {'season': d['season'], 'lifters': len(hist), 'withQy': sum(1 for h in hist.values() if 'qy' in h)}

# ---- team standings: TCRR place points on the total, top 5 per club per gender ----
def team_table(rs):
    by_class = collections.defaultdict(list)
    for cls, x in rs: by_class[cls].append(x)
    lifter_pts = {}  # (club, sex, id) -> (pts, place, name, cls)
    for cls, xs in by_class.items():
        xs = sorted(xs, key=lambda x: (-x[2], x[6]))  # heavier total first; lighter bodyweight wins ties
        for i, x in enumerate(xs[:25]):
            if x[4] < 0: continue
            k = (C[x[4]], sex_of(cls), x[9])
            p = TEAM_PTS[i]
            if k not in lifter_pts or p > lifter_pts[k][0]:
                lifter_pts[k] = (p, i + 1, x[3], cls)
    clubs = collections.defaultdict(lambda: {'W': [], 'M': []})
    for (club, sx, _), v in lifter_pts.items(): clubs[club][sx].append(v)
    res = {}
    for scope in ('A', 'W', 'M'):
        t = []
        for club, g in clubs.items():
            sc = [s for s in 'WM' if scope in ('A', s)]
            counted = {s: sorted(g[s], key=lambda v: -v[0])[:5] for s in sc}
            pts = sum(v[0] for s in sc for v in counted[s])
            if not pts: continue
            places = sorted([v[1] for s in sc for v in counted[s]])
            t.append({'club': club, 'pts': pts, 'n': sum(len(counted[s]) for s in sc),
                      'firsts': sum(1 for p in places if p == 1), 'places': places,
                      'top': [[v[2], v[3], v[1], v[0]] for s in sc for v in counted[s]]})
        # TCRR 6.8.5 tie-break: more of the higher places
        t.sort(key=lambda r: (-r['pts'], [-places_count for places_count in [r['places'].count(p) for p in range(1, 26)]]))
        res[scope] = t[:15]
    return res

out['teams'] = {'open': {'season': team_table(rows), 'since': team_table([(c, x) for c, x in rows if x[7] >= NEW_CLASSES])}}

# ---- youth team standings: separate from Open. Youth classes are too thin for per-class places,
# so youth lifters are ranked together by Q-Youth (per sex) and scored with the same TCRR place points.
def youth_team_table(since):
    best = {}
    for g, cl in d['youth'].items():
        for cls, xs in cl.items():
            sx = sex_of(cls)
            for x in xs:
                if x[7] < since or x[4] < 0: continue
                r = qyouth(x[2], x[6], x[5], sx)
                if r is None: continue
                qy, est = r
                if x[9] not in best or qy > best[x[9]][0]:
                    best[x[9]] = (qy, est, sx, C[x[4]], x[3], f"{g.replace(' Under', ' & Under')} {cls.split(' ', 1)[1]}")
    clubs = collections.defaultdict(lambda: {'W': [], 'M': []})
    for sx in 'WM':
        ranked = sorted([v for v in best.values() if v[2] == sx], key=lambda v: -v[0])
        for i, (qy, est, _, club, name, lab) in enumerate(ranked[:25]):
            clubs[club][sx].append((TEAM_PTS[i], i + 1, name, f"{lab} · {qy:.1f} Q-Youth{'*' if est else ''}"))
    res = {}
    for scope in ('A', 'W', 'M'):
        t = []
        for club, g in clubs.items():
            sc = [s for s in 'WM' if scope in ('A', s)]
            counted = {s: sorted(g[s], key=lambda v: -v[0])[:5] for s in sc}
            pts = sum(v[0] for s in sc for v in counted[s])
            if not pts: continue
            places = sorted(v[1] for s in sc for v in counted[s])
            t.append({'club': club, 'pts': pts, 'n': sum(len(counted[s]) for s in sc), 'firsts': places.count(1),
                      'places': places, 'top': [[v[2], v[3], v[1], v[0]] for s in sc for v in counted[s]]})
        t.sort(key=lambda r: (-r['pts'], [-r['places'].count(p) for p in range(1, 26)]))
        res[scope] = t[:15]
    return res

out['teams']['youth'] = {'season': youth_team_table('0101'), 'since': youth_team_table(NEW_CLASSES)}

# ---- quarter since new classes ----
since = [(c, x) for c, x in rows if x[7] >= NEW_CLASSES]
Ls = lifter_entries(since)
mon = collections.Counter(int(x[7][:2]) for _, x in rows)
youth_hi = []
for g, cl in d['youth'].items():
    for cls, v in cl.items():
        for x in v:
            if x[7] >= NEW_CLASSES and x[1] <= 3:
                youth_hi.append({'group': g, 'cls': cls, 'name': x[3], 'total': x[2], 'us': x[1], 'date': x[7], 'lvl': x[8], 'club': C[x[4]]})
out['quarter'] = {
    'from': NEW_CLASSES, 'results': len(since), 'lifters': len({x[9] for _, x in since}),
    'clubs': len({x[4] for _, x in since}),
    'byDate': dict(collections.Counter(x[7] for _, x in since)),
    'usTop10': sorted([{'cls': c, 'name': x[3], 'total': x[2], 'us': x[1], 'date': x[7], 'club': C[x[4]], 'lvl': x[8]} for c, x in since if x[1] <= 10], key=lambda r: r['us']),
    'pnwFirsts': [{'cls': c, 'name': x[3], 'total': x[2], 'date': x[7], 'club': C[x[4]], 'lvl': x[8]} for c, x in since if x[0] == 1],
    'intl': sorted({(x[3], x[7], c, x[2]) for c, x in since if x[8] == 'I'}, key=lambda r: r[1]),
    'national': len([1 for _, x in since if x[8] == 'N']),
    'bestQ': {s: sorted([l for l in Ls if l['sex'] == s], key=lambda l: -l['q'])[:3] for s in 'WM'},
    'youth': sorted(youth_hi, key=lambda r: (r['us'], r['group'])),
}
# ---- adaptive results: self-identified (opted-in) PNW athletes matched to adaptive sessions in USAW results books ----
optin = json.load(open(os.path.join(DATA, 'adaptive.json')))['athletes']
AR = json.load(open(os.path.join(DATA, 'adaptive-results.json')))
CAT = {'PD': 'Physical impairment', 'VI': 'Visual impairment', 'DHH': 'Deaf / hard of hearing', 'ID': 'Intellectual impairment'}
idname = {}
for _, x in rows: idname.setdefault(str(x[9]), (x[3], C[x[4]] if x[4] >= 0 else ''))
adp = []
for mid, cat in optin.items():
    if mid not in idname: continue
    name, club = idname[mid]
    res = [r for r in AR['results'] if r['name'].lower() == name.lower()]
    adp.append({'id': int(mid), 'name': name, 'club': club, 'cat': CAT.get(cat, ''), 'results': res})
out['adaptive'] = {'athletes': adp, 'placings': len(AR['results']), 'events': sorted({r['event'] for r in AR['results']})}

qtp = os.path.join(DATA, 'qualifying-2027.json')
out['qt'] = json.load(open(qtp)) if os.path.exists(qtp) else None

out['byMonth'] = [mon.get(m, 0) for m in range(1, 13)]
out['counts'] = {'results': len(rows), 'lifters': len(L), 'clubs': len({x[4] for _, x in rows})}
with open(out_path, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print(f"new-pages.json: {out['counts']['lifters']} lifters, {len(out['teams']['open']['season']['A'])} clubs in standings, "
      f"{out['archive']['lifters']} archived, {len(out['qt']['totals']) if out['qt'] else 0} qualifying totals")
