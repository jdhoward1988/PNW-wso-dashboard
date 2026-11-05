# PNW WSO Competition Calendar

USAW national events and PNW WSO local meets for Alaska, Oregon and Washington, served with GitHub Pages and linked from pnwwsoweightlifting.com.

- `index.html` is the whole calendar (styles and scripts are inline).
- The Upcoming Local Events list loads live from the WSO's Google Apps Script endpoint.
- The Host an Event form submits to the WSO's Google Form.
- To update events, edit the `event-row` blocks in `index.html` and commit; the site republishes in about a minute.

## Automatic updates (no laptop needed)
- **GitHub Actions** (`.github/workflows/sport80.yml`, ~2:07 AM Pacific daily, often started a few hours late by GitHub) loads Sport80 in a headless browser and writes `data/sport80-events.json` (upcoming in-person meets, courses and camps in AK/OR/WA) and `data/cloud-status.json`. It also rebuilds `data/rankings.json` and `data/adaptive.json` every day. Run it by hand from the **Actions** tab → "Sport80 check" → **Run workflow**. GitHub emails the owner if a run fails.
- **Claude scheduled task** "PNW WSO calendar daily update (cloud)" (5:59 AM Pacific) reads those files plus USAW's national events and the sanctioned-meets sheet, and adds new rows to `index.html`.
- Action logs are public, so the job never prints adaptive athletes' names or membership numbers.

## Draft pages (in review)
Seven new pages are published as drafts, reachable from the gold **Draft pages** bar under the top bar on every page (`assets/draft-bar.js`; edit its list to add, remove or graduate a page):
`season-bests.html`, `qualifying-totals.html`, `outstanding-athletes.html`, `club-standings.html`, `adaptive-results.html`, `quarterly-update.html`, `referees.html`.
- They share `assets/new-pages.css` and `assets/new-pages.js`, and read `data/new-pages.json`, built daily from `data/rankings.json` by `scripts/features/build.py` (Q-points, Q-Masters, Q-Youth from `scripts/features/qyouth_factors.json`, USAW-style club scoring, season bests, quarterly letter data). The same run saves each lifter's best scores to `data/history/<season>.json` for next season's Most Improved.
- `data/qualifying-2027.json` comes from USAW's 2027 Qualifying Totals PDF; replace it when USAW posts a new version.
- `data/adaptive-results.json` lists adaptive sessions (ADP/ADAP) from USAW's national results books; add new events as USAW posts them.
- `data/referees.json` is refreshed daily by the cloud job from Sport80's public Referees listing (widget 5), filtered to AK/OR/WA. The listing only includes officials who opt in on Sport80. WSO corrections (a different level, or an official missing from the listing) go in `data/referees-overrides.json` and are marked with * on the page.
- To publish a draft page for real: add it to the top bar on each page and remove it from `DRAFT_PAGES` in `assets/draft-bar.js`.
