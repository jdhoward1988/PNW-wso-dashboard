#!/usr/bin/env python3
"""Update data/adaptive.json from the approved opt-ins (Apps Script web app output).

  python3 scripts/adaptive/sync.py approved.json [members.json]

approved.json is the web app's response ({"athletes":[{name, club, member, id, category}]}),
saved from a browser (fetch tools are blocked by Google's bot checks). "member" is a SHA-256
hash of the athlete's USAW membership number (the raw number never leaves the private sheet).
members.json is {hash: profileId|null} from `await window._pnwMemberIds([...hashes])` on the
USAW rankings page after running scripts/rankings/fetch.js.

Each approved athlete is matched to a USAW rankings profile id:
  1. the profile id the reviewer entered in the sheet, else
  2. their USAW member number (looked up in members.json), else
  3. an exact name match in data/rankings.json (case/spacing-insensitive),
     narrowed by club if the name belongs to more than one lifter.
Athletes that can't be matched with certainty are NOT added; they are listed so the
reviewer can fill "USAW profile ID" in the sheet. Nothing is guessed.
Only id -> category code ("" = show "Adaptive" only) is written to the public file.
"""
import json, sys, re, os, pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
RANK = ROOT / 'data' / 'rankings.json'
OUT = ROOT / 'data' / 'adaptive.json'
CODES = {'PD', 'VI', 'DHH', 'ID', ''}
# Set by the GitHub Actions job: its logs are public, so print counts instead of names there.
NO_NAMES = os.environ.get('PNW_NO_NAMES') == '1'


def who(a):
    return 'an approved athlete' if NO_NAMES else (a.get('name') or '(no name)')


def norm(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip().lower()


def today():
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date().isoformat()
    except Exception:
        return datetime.date.today().isoformat()


def main():
    approved = json.loads(pathlib.Path(sys.argv[1]).read_text())['athletes']
    rk = json.loads(RANK.read_text())
    clubs = rk['clubs']
    people = {}  # normalized name -> {id: set(clubs)}
    ids = set()
    groups = list(rk['classes'].values()) + [v for g in rk.get('youth', {}).values() for v in g.values()]
    for rows in groups:
        for r in rows:
            ids.add(r[9])
            people.setdefault(norm(r[3]), {}).setdefault(r[9], set()).add(norm(clubs[r[4]]) if r[4] >= 0 else '')

    members = json.loads(pathlib.Path(sys.argv[2]).read_text()) if len(sys.argv) > 2 else {}
    cur = json.loads(OUT.read_text())
    athletes, unmatched = {}, []
    for a in approved:
        cat = a.get('category') or ''
        if cat not in CODES:
            cat = ''
        aid = a.get('id')
        num = str(a.get('member') or '').strip().lower()
        if not aid and num and members.get(num):
            aid = members[num]
        if not aid:
            cands = people.get(norm(a.get('name')), {})
            if len(cands) > 1 and a.get('club'):
                cands = {k: v for k, v in cands.items() if norm(a['club']) in v}
            if len(cands) == 1:
                aid = next(iter(cands))
        if not aid and a.get('club'):
            # Name with an extra part in parentheses, e.g. "Jane Doe (Smith)": only accepted
            # when the club matches too and exactly one lifter fits both.
            short = norm(re.sub(r'\([^)]*\)', ' ', a.get('name') or ''))
            if short and short != norm(a.get('name')):
                cands = {k: v for k, v in people.get(short, {}).items() if norm(a['club']) in v}
                if len(cands) == 1:
                    aid = next(iter(cands))
                    print(f'note: matched {who(a)} to a ranked lifter by name + club (name had a part in parentheses)')
        if aid:
            athletes[str(int(aid))] = cat
            if int(aid) not in ids:
                print(f'note: {who(a)} has no PNW ranked result this season yet; kept for when they do')
        elif num and num in members and members[num] is None:
            print(f'note: {who(a)} has no PNW ranked result this season yet; will match by member number once they do')
        else:
            unmatched.append(who(a))

    changed = athletes != cur.get('athletes', {})
    cur['athletes'] = dict(sorted(athletes.items(), key=lambda kv: int(kv[0])))
    if changed:
        cur['updated'] = today()
    OUT.write_text(json.dumps(cur, ensure_ascii=False, indent=1) + '\n')
    print(f'{"CHANGED" if changed else "SAME"}: {len(athletes)} adaptive athletes listed')
    for n in unmatched:
        print(f'UNMATCHED: {n} (fill "USAW profile ID" in the opt-in sheet)')


if __name__ == '__main__':
    main()
