#!/usr/bin/env python3
"""Read USA Weightlifting's qualifying totals straight from USAW, so nobody has to supply the PDF.

  python3 scripts/cloud/qualifying.py            (run from the repo root; the cloud job runs it daily)
  python3 scripts/cloud/qualifying.py file.pdf   (parse a saved copy instead of downloading)

Opens USAW's qualifying totals page, follows its link to the "Qualifying Totals" PDF, reads every
row (Event, Age, Gender, Bodyweight, QT, Adaptive QT) and rewrites the "totals" list in
data/qualifying-2027.json when anything changed. The "events" list in that file (event dates,
places and qualifying windows) is not in the PDF and is kept as it is.

Safety: the file is only rewritten when the PDF parses cleanly, every row maps to a known event
and age group, and the row count is within 10% of the previous file. Otherwise the old file stays
and the run is reported as failed in data/cloud-status.json ("qualifying").
Needs pypdf (pip install pypdf).
"""
import datetime, hashlib, io, json, pathlib, re, sys, urllib.parse, urllib.request
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
YEAR = 2027
PAGE = f'https://www.usaweightlifting.org/{YEAR}-USA-Weightlifting-National-Event-Qualifying-Totals'
OUT = DATA / f'qualifying-{YEAR}.json'
UA = 'Mozilla/5.0 (compatible; pnw-wso-calendar-check; +https://github.com/Jdhoward1988/PNW-wso-dashboard)'
TODAY = datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date().isoformat()

# PDF labels -> the keys and labels the site already uses
EVENTS = {'Nationals': 'NAT', 'NationalChampionships': 'NAT', 'Series': 'SER', 'UniversityNationals': 'UNI',
          'MastersNationals': 'MAS', 'YouthNationals': 'YTH', 'JuniorNationals': 'JRN', 'U25Nationals': 'U25N', 'Finals': 'VWF'}
ROW = re.compile(r'^([A-Za-z0-9]+)\s+(\S+)\s+([MWF])\s+(\d+\+?kg)\s+(\d+)\s+(\d+)\s*$')


def age_of(label):
    """PDF age label -> (age group, sub-group or None)."""
    if label == 'Open': return 'Open', None
    if label == 'Junior': return 'Junior', None
    if label == 'U25': return 'U25', None
    if label in ('Unis', 'University'): return 'University', None
    if re.fullmatch(r'11\s*&\s*U', label): return 'Youth', '11 & Under'
    m = re.fullmatch(r'(\d+)-(\d+)yo', label)
    if m: return 'Youth', f'{m[1]}–{m[2]}'
    m = re.fullmatch(r'Masters(\d+)', label)
    if m:
        lo = int(m[1])
        return 'Masters', '90+' if lo >= 90 else f'{lo}–{lo + 4}'
    raise ValueError(f'unknown age group in the PDF: {label!r}')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def find_pdf(page_html):
    links = re.findall(r'href="([^"]+\.pdf)"', page_html, flags=re.I)
    good = [l for l in links if re.search(r'qualifying[_\- ]*totals', urllib.parse.unquote(l), flags=re.I)]
    if not good:
        raise ValueError("no Qualifying Totals PDF link on USAW's page")
    return urllib.parse.urljoin(PAGE, good[0].replace('&amp;', '&'))


def parse(pdf_bytes):
    from pypdf import PdfReader
    rows, bad = [], []
    for page in PdfReader(io.BytesIO(pdf_bytes)).pages:
        for line in (page.extract_text() or '').splitlines():
            line = line.strip()
            m = ROW.match(line)
            if not m:
                if re.search(r'\d+\+?kg', line): bad.append(line)   # looks like a data row we couldn't read
                continue
            ev, age, sex, cls, total, adp = m.groups()
            if ev not in EVENTS: raise ValueError(f'unknown event in the PDF: {ev!r}')
            group, sub = age_of(age)
            r = {'event': EVENTS[ev], 'age': group, 'sex': 'W' if sex in 'WF' else 'M', 'cls': cls, 'total': int(total), 'adp': int(adp)}
            if sub: r['sub'] = sub
            rows.append(r)
    if bad: raise ValueError(f'{len(bad)} rows could not be read, e.g. {bad[0]!r}')
    seen = set()
    for r in rows:
        k = (r['event'], r['age'], r.get('sub'), r['sex'], r['cls'])
        if k in seen: raise ValueError(f'duplicate row in the PDF: {k}')
        seen.add(k)
    return rows


def key(r): return (r['event'], r['age'], r.get('sub') or '', r['sex'], r['cls'])


def main():
    status = {'checked': TODAY, 'ok': False}
    try:
        old = json.loads(OUT.read_text())
        if len(sys.argv) > 1:
            url, pdf = sys.argv[1], pathlib.Path(sys.argv[1]).read_bytes()
        else:
            url = find_pdf(get(PAGE).decode('utf-8', 'replace'))
            pdf = get(url)
        rows = parse(pdf)
        n_old = len(old.get('totals', []))
        if not rows or (n_old and abs(len(rows) - n_old) > 0.1 * n_old):
            raise ValueError(f'read {len(rows)} totals but the saved file has {n_old}; not replacing it')
        missing = {e['key'] for e in old['events']} - {r['event'] for r in rows}
        if missing: raise ValueError(f'no totals in the PDF for {sorted(missing)}')
        before = {key(r): (r['total'], r['adp']) for r in old['totals']}
        after = {key(r): (r['total'], r['adp']) for r in rows}
        changed = sorted(k for k in after if before.get(k) != after[k]) + sorted(k for k in before if k not in after)
        status.update(ok=True, count=len(rows), changed=len(changed), pdf=url)
        if changed or old.get('pdf') != url:
            # keep the saved row order where rows still exist, so the diff shows only real changes
            order = {key(r): i for i, r in enumerate(old['totals'])}
            rows.sort(key=lambda r: (order.get(key(r), len(order)),))
            old['totals'] = rows
            old['pdf'] = url
            old['pdfHash'] = hashlib.sha256(pdf).hexdigest()[:16]
            if changed: old['totalsChanged'] = TODAY
            old['source'] = (f"USA Weightlifting, {YEAR} Qualifying Totals PDF, read automatically from USAW's qualifying totals page"
                             f" (last change {old.get('totalsChanged', 'none since the first copy')}); event dates and windows from USAW, Aug 6, 2026")
            OUT.write_text(json.dumps(old, separators=(',', ':')))
        print(f"qualifying totals: {len(rows)} rows read, {len(changed)} changed")
        for k in changed[:20]: print('  changed:', k, before.get(k), '->', after.get(k))
    except Exception as e:
        status['error'] = str(e)[:300]
        print('qualifying totals NOT updated:', status['error'])
    sp = DATA / 'cloud-status.json'
    try:
        st = json.loads(sp.read_text())
        st['qualifying'] = status
        sp.write_text(json.dumps(st, indent=1) + '\n')
    except Exception:
        pass
    sys.exit(0 if status['ok'] else 1)


if __name__ == '__main__':
    main()
