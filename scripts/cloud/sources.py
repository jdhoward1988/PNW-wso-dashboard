#!/usr/bin/env python3
"""Save copies of the two non-Sport80 sources the daily Claude update checks, so the update
never has to fetch them itself (unattended runs can't approve web fetches):

  data/usaw-national-events.json  — events listed on https://www.usaweightlifting.org/national-events
                                     (name, start/end, location, event page) plus the page text
                                     around them, in case the layout changes and parsing misses one.
  data/sanctioned-meets.json      — every row of the PNW WSO Sanctioned Meets Google Sheet
                                     (CSV export; the sheet must be viewable by anyone with the link).

Adds a "sources" entry to data/cloud-status.json (run after sport80.mjs, which rewrites that file).
A failed source keeps its previous file and is reported as ok: false. Standard library only.
"""
import csv, datetime, hashlib, html, io, json, pathlib, re, sys, urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
NATIONAL_URL = 'https://www.usaweightlifting.org/national-events'
SHEET_ID = '1TKmTIMT-Hm0bQHlxFZ7ZC_g9FJgRmO_wdLdfOiTQyl4'
SHEET_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0'
UA = 'Mozilla/5.0 (compatible; pnw-wso-calendar-check; +https://github.com/Jdhoward1988/PNW-wso-dashboard)'
from zoneinfo import ZoneInfo
TODAY = datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date()  # same Pacific date as sport80.mjs

MON = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?'
DATE = rf'{MON}\s+\d{{1,2}},?\s+\d{{4}}'
RANGE = re.compile(rf'({DATE})(?:\s*[-–—]\s*({DATE}))?')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,text/csv,*/*'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.geturl(), r.headers.get('Content-Type', ''), r.read().decode('utf-8', 'replace')


def iso(s):
    s = re.sub(r'\.|,', '', s).replace('Sept', 'Sep')
    for fmt in ('%b %d %Y', '%B %d %Y'):
        try:
            return datetime.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return None


class Lines(HTMLParser):
    """Page text, one line per block element, with the links found on each line."""
    BLOCK = {'p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'tr', 'td', 'section', 'article', 'span'}
    SKIP = {'script', 'style', 'noscript', 'svg', 'head'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines, self.cur, self.links, self.skip, self.href, self.atext = [], [], [], 0, None, []

    def flush(self):
        t = re.sub(r'\s+', ' ', ''.join(self.cur)).strip()
        if t:
            self.lines.append((t, self.links))
        self.cur, self.links = [], []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag == 'a':
            self.href, self.atext = dict(attrs).get('href'), []
        if tag in self.BLOCK and tag != 'span':
            self.flush()

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif tag == 'a' and self.href:
            self.links.append((re.sub(r'\s+', ' ', ''.join(self.atext)).strip(), self.href))
            self.href = None
        if tag in self.BLOCK and tag != 'span':
            self.flush()

    def handle_data(self, d):
        if not self.skip:
            self.cur.append(d)
            if self.href:
                self.atext.append(d)


def absolute(href):
    if not href:
        return None
    if href.startswith('/'):
        return 'https://www.usaweightlifting.org' + href
    return href if href.startswith('http') else None


def national():
    final, ctype, body = get(NATIONAL_URL)
    p = Lines(); p.feed(body); p.flush()
    lines = p.lines
    events, used = [], set()
    for i, (t, _) in enumerate(lines):
        m = RANGE.search(t)
        if not m or i in used:
            continue
        start, end = iso(m.group(1)), iso(m.group(2) or m.group(1))
        if not start:
            continue
        # Name: the date line minus the dates if that leaves a title, else the nearest line above.
        name, link = None, None
        rest = (t[:m.start()] + t[m.end():]).strip(' |·-–')
        cands = ([(rest, lines[i][1])] if len(rest) > 12 and not RANGE.search(rest) else []) + \
                [lines[j] for j in range(i - 1, max(-1, i - 5), -1)]
        for ct, cl in cands:
            if len(ct) > 12 and not RANGE.search(ct) and not re.match(r'(?i)(learn more|register|view|details|more info)', ct):
                name = ct
                link = next((absolute(h) for a, h in cl if absolute(h)), None)
                break
        loc = []
        for j in range(i + 1, min(len(lines), i + 4)):
            lt = lines[j][0]
            if not link and re.match(r'(?i)(learn more|register|view|details|more info)', lt):
                link = next((absolute(h) for a, h in lines[j][1] if absolute(h)), None)
            if RANGE.search(lt) or len(lt) > 120 or re.match(r'(?i)(learn more|register|view|details|more info)$', lt):
                break
            if name and lt == name:
                break
            loc.append(lt)
            if not link:
                link = next((absolute(h) for a, h in lines[j][1] if absolute(h)), None)
        if not link and name:  # a link elsewhere on the page whose text is the event name
            link = next((absolute(h) for t2, ls in lines for a, h in ls if a == name and absolute(h)), None)
        if name:
            used.add(i)
            events.append({'name': html.unescape(name), 'start': start, 'end': end,
                           'location': ' | '.join(loc[:2]) or None, 'eventPage': link})
    # dedupe (some layouts repeat a card for mobile)
    seen, uniq = set(), []
    for e in events:
        k = (e['name'], e['start'])
        if k not in seen:
            seen.add(k); uniq.append(e)
    text = '\n'.join(t for t, _ in lines)
    a = text.find('Upcoming')
    snippet = text[a if a >= 0 else 0:][:8000]
    if not uniq and not RANGE.search(text):
        raise RuntimeError(f'no events or dates found on the page (final URL {final}, {ctype}); layout may have changed')
    return {'source': NATIONAL_URL, 'finalUrl': final, 'events': uniq, 'pageText': snippet}


def sheet():
    final, ctype, body = get(SHEET_URL)
    if 'csv' not in ctype.lower() or body.lstrip().startswith('<'):
        raise RuntimeError(f'sheet did not return CSV ({ctype}; ended at {final.split("?")[0]}). '
                           'Share it as "Anyone with the link can view".')
    rows = [r for r in csv.reader(io.StringIO(body)) if any(c.strip() for c in r)]
    if not rows:
        raise RuntimeError('sheet returned no rows')
    head, data = rows[0], rows[1:]
    return {'source': f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid=0',
            'header': head, 'rows': [dict(zip(head, r + [''] * (len(head) - len(r)))) for r in data]}


def save(name, payload, key):
    out = DATA / name
    try:
        old = json.loads(out.read_text())
    except Exception:
        old = None
    digest = hashlib.sha256(json.dumps(payload[key], sort_keys=True).encode()).hexdigest()[:16]
    changed = not old or old.get('hash') != digest
    if old and old.get(key) and not payload[key]:
        raise RuntimeError('empty result while the saved copy has entries; keeping the previous copy')
    payload = {'checked': TODAY.isoformat(), 'hash': digest,
               'lastChanged': TODAY.isoformat() if changed else (old or {}).get('lastChanged'), **payload}
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + '\n')
    return changed


def main():
    status, failed = {}, False
    for label, fn, fname, key in (('national', national, 'usaw-national-events.json', 'events'),
                                  ('sanctionedSheet', sheet, 'sanctioned-meets.json', 'rows')):
        try:
            res = fn()
            changed = save(fname, res, key)
            status[label] = {'ok': True, 'changed': changed, 'count': len(res[key])}
            print(f'{label}: OK, {len(res[key])} {key}, changed={changed}')
        except Exception as e:
            failed = True
            status[label] = {'ok': False, 'error': str(e)[:300]}
            print(f'{label}: FAILED: {e}', file=sys.stderr)
    cs = DATA / 'cloud-status.json'
    try:
        st = json.loads(cs.read_text())
    except Exception:
        st = {}
    st['sources'] = {'checked': TODAY.isoformat(), **status}
    cs.write_text(json.dumps(st, indent=1) + '\n')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
