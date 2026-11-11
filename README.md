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
Nine new pages are published as drafts, reachable from the gold **Draft pages** bar under the top bar on every page (`assets/draft-bar.js`; edit its list to add, remove or graduate a page):
`planner.html`, `roster.html`, `season-bests.html`, `qualifying-totals.html`, `outstanding-athletes.html`, `club-standings.html`, `adaptive-results.html`, `quarterly-update.html`, `referees.html`.
- They share `assets/new-pages.css` and `assets/new-pages.js`, and read `data/new-pages.json`, built daily from `data/rankings.json` by `scripts/features/build.py` (Q-points, Q-Masters, Q-Youth from `scripts/features/qyouth_factors.json`, USAW-style club scoring, season bests, quarterly letter data). The same run saves each lifter's best scores to `data/history/<season>.json` for next season's Most Improved.
- `data/qualifying-2027.json`: the totals are read every day from the PDF linked on USAW's 2027 qualifying totals page (`scripts/cloud/qualifying.py`); a changed total is picked up on the next run and listed in the Action log. The file is only replaced when the PDF reads cleanly. Event dates and qualifying windows in its `events` list are not in the PDF and are still edited by hand.
- `data/adaptive-results.json` lists adaptive sessions (ADP/ADAP) from USAW's national results books; add new events as USAW posts them.
- `data/referees.json` is refreshed daily by the cloud job from Sport80's public Referees listing (widget 5), filtered to AK/OR/WA. The listing only includes officials who opt in on Sport80. WSO corrections (a different level, or an official missing from the listing) go in `data/referees-overrides.json` and are marked with * on the page.
- To publish a draft page for real: add it to the top bar on each page and remove it from `DRAFT_PAGES` in `assets/draft-bar.js`.
- `planner.html` (Season planner, for coaches) needs no upkeep: it reads the qualifying windows from `data/qualifying-2027.json` (inside `data/new-pages.json`), PNW meets, courses and camps from `data/sport80-events.json`, national events from `data/usaw-national-events.json` and planned sanctioned meets from `data/local-events.json`. Picking an event shows the sanctioned meets left inside its qualifying window; any row can be saved to a phone calendar (.ics). The qualifying totals page links each event to it.
- On all draft pages, filter choices are remembered on the visitor's device (`localStorage`), the board's draft notes are collapsed under the content, phones get a short header, and screens 2200px and wider scale the whole page up (`zoom`). The calendar and rankings pages already had their own large-screen rules and are unchanged.
- `roster.html` (Qualifying tracker, for coaches) also needs no upkeep. For a chosen 2027 national event and club it checks every saved result for each lifter against `data/qualifying-2027.json`, using the rule on USAW's qualifying totals page (the total must be made inside the event's window and meet the standard for the class lifted in that day; the lifter may then register in any class): **Qualified**, **Legacy total** (made the total, but only before the window opened) or kg short. The three summary cards filter the list when clicked. The list downloads as CSV and prints.
- `data/results.json` (`scripts/rankings/results.py`, daily) holds every meet result since January 1 of last season for each PNW lifter (date, total, bodyweight, best snatch, best clean & jerk, category, meet) and each lifter's birth year. Lifters stay in the file after the season rolls over, so last season's totals keep counting. Each run re-reads new lifters, lifters with a result in the last 45 days, and a seventh of the rest; `--all` re-reads everyone. If the file is missing the tracker falls back to `data/rankings.json`.
- National events in `data/usaw-national-events.json` carry `keyDates` (registration opens and closes, qualification period, schedule dates) read from each event's USAW page; the planner lists the registration dates.
- The draft pages load `assets/new-pages.css`, `assets/new-pages.js` and `assets/draft-bar.js` with a `?v=` date on the end. Change that date in the pages whenever one of those files changes, so visitors' browsers don't keep running the old copy.
