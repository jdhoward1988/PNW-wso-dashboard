# PNW WSO Competition Calendar

USAW national events and PNW WSO local meets for Alaska, Oregon and Washington, served with GitHub Pages and linked from pnwwsoweightlifting.com.

- `index.html` is the whole calendar (styles and scripts are inline).
- The Upcoming Local Events list loads live from the WSO's Google Apps Script endpoint.
- The Host an Event form submits to the WSO's Google Form.
- To update events, edit the `event-row` blocks in `index.html` and commit; the site republishes in about a minute.

## Automatic updates (no laptop needed)
- **GitHub Actions** (`.github/workflows/sport80.yml`, ~4:23 AM Pacific daily) loads Sport80 in a headless browser and writes `data/sport80-events.json` (upcoming in-person meets, courses and camps in AK/OR/WA) and `data/cloud-status.json`. On Wednesdays it also rebuilds `data/rankings.json` and `data/adaptive.json`. Run it by hand from the **Actions** tab → "Sport80 check" → **Run workflow** (tick the box to include rankings). GitHub emails the owner if a run fails.
- **Claude scheduled task** "PNW WSO calendar daily update (cloud)" (5:59 AM Pacific) reads those files plus USAW's national events and the sanctioned-meets sheet, and adds new rows to `index.html`.
- Action logs are public, so the job never prints adaptive athletes' names or membership numbers.
