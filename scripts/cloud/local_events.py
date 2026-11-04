#!/usr/bin/env python3
"""Save a copy of the Upcoming Local Events list (the "Add Your Event" responses served by the
Apps Script web app) to data/local-events.json, so the calendar page can show it instantly and
keep showing it if Google is slow or down. Run hourly by .github/workflows/local-events.yml.

Writes only when the list itself changed. Refuses to overwrite a good copy with an empty or
malformed answer (a Google hiccup must not blank the list).
"""
import json, re, sys, pathlib, datetime, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'data' / 'local-events.json'
html = (ROOT / 'index.html').read_text()
m = re.search(r'INTEREST_API_URL\s*=\s*"([^"]+)"', html)
if not m:
    sys.exit('INTEREST_API_URL not found in index.html')

req = urllib.request.Request(m.group(1), headers={'Accept': 'application/json', 'User-Agent': 'pnw-wso-calendar-snapshot'})
with urllib.request.urlopen(req, timeout=60) as r:
    rows = json.loads(r.read().decode('utf-8'))
if not isinstance(rows, list) or not all(isinstance(x, dict) for x in rows):
    sys.exit('Unexpected answer from the web app; keeping the previous copy')

old = None
try:
    old = json.loads(OUT.read_text())
except Exception:
    pass
if old and old.get('rows') and not rows:
    sys.exit('Web app returned an empty list while the saved copy has entries; keeping the previous copy')
if old and old.get('rows') == rows:
    print(f'SAME: {len(rows)} entries')
    sys.exit(0)
OUT.write_text(json.dumps({
    'source': 'Add Your Event responses (Apps Script web app), copied hourly; the page also checks the live list',
    'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'rows': rows,
}, ensure_ascii=False, indent=1) + '\n')
print(f'CHANGED: {len(rows)} entries')
