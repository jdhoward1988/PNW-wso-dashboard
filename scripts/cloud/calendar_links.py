#!/usr/bin/env python3
"""Point each calendar row's link at the event itself, not at Sport80's list of all meets or courses.

  python3 scripts/cloud/calendar_links.py      (run from the repo root after sport80.mjs; daily)

For every row in index.html whose link is a Sport80 list page (/public/widget/1, 2 or 3), find the
same event in data/sport80-events.json (same start date and a matching name or city) and use the
link chosen there: its Sport80 entry or event page, the host's website, or an email to the meet
director. Rows that can't be matched (usually events that already happened) are left alone.
assets/event-links.js does the same in the browser, for rows added after this runs.
Standard library only; prints counts only.
"""
import html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
PAGE = ROOT / 'index.html'
LIST_LINK = re.compile(r'https://usaweightlifting\.sport80\.com/public/widget/[123]\b[^"]*')
STOP = {'the', 'and', 'of', 'at', 'usaw', 'meet', 'open', 'classic', 'wa', 'or', 'ak'}


def words(s):
    s = re.sub(r'\b20\d\d\b', ' ', html.unescape(s).lower())
    return {w for w in re.findall(r'[a-z]+', s) if w not in STOP and len(w) > 2}


def match(name, meta, start, events):
    same_day = [e for e in events if e.get('start') == start and e.get('link')]
    best, score = None, 0
    for e in same_day:
        a, b = words(name), words(e['name'])
        s = len(a & b) / max(1, min(len(a), len(b)))
        city = (e.get('city') or '').lower()
        if city and city in (name + ' ' + meta).lower():
            s += 0.5
        if s > score:
            best, score = e, s
    return best if score >= 0.5 else None


def main():
    d = json.loads((ROOT / 'data' / 'sport80-events.json').read_text())
    events = [e for arr in d['lists'].values() for e in arr] + [e for e in d.get('unlisted', []) if e.get('link')]
    s = PAGE.read_text()
    fixed = left = 0

    def row(m):
        nonlocal fixed, left
        block = m.group(0)
        if not LIST_LINK.search(block):
            return block
        start = (re.search(r'data-start="([\d-]+)"', block) or [None, ''])[1]
        name = (re.search(r'class="ev-name"[^>]*>(.*?)</div>', block, re.S) or [None, ''])[1]
        meta = (re.search(r'class="ev-meta"[^>]*>(.*?)</div>', block, re.S) or [None, ''])[1]
        e = match(re.sub(r'<[^>]+>', '', name), re.sub(r'<[^>]+>', '', meta), start, events)
        if not e:
            left += 1
            return block
        url = html.escape(e['link'], quote=True)
        if f'href="{url}"' in block:
            return block
        fixed += 1
        a = re.compile(r'<a class="ev-link([^"]*)" href="' + LIST_LINK.pattern + r'"( target="_blank" rel="noopener")?>[^<]*</a>')
        attrs = '' if url.startswith('mailto:') else ' target="_blank" rel="noopener"'
        return a.sub(lambda x: f'<a class="ev-link{x.group(1)}" href="{url}"{attrs}>{html.escape(e["linkLabel"])} →</a>', block, count=1)

    out = re.sub(r'<div class="event-row"[^>]*>.*?\n    </div>\n', row, s, flags=re.S)
    if out != s:
        PAGE.write_text(out)
    print(f'calendar links: {fixed} rows updated, {left} rows left on the plain Sport80 search (no match, usually past events)')


if __name__ == '__main__':
    main()
