// Calendar rows that still link to a Sport80 list page (all meets, all courses, all camps) are pointed at
// the event itself, using the link the daily Sport80 check chose (data/sport80-events.json): its Sport80
// entry or event page, the host's website, or an email to the meet director. When the meet lists its own
// website and the main link goes elsewhere, a second "Meet website" link is added beside it. Same matching as
// scripts/cloud/calendar_links.py, which fixes the saved page each night; this covers rows added since.
(function () {
  var LIST = /^https:\/\/usaweightlifting\.sport80\.com\/public\/widget\/[123]\b/;
  var today = new Date().toISOString().slice(0, 10);
  var rows = [].slice.call(document.querySelectorAll('.event-row')).filter(function (r) {
    return r.querySelector('a.ev-link') && (r.getAttribute('data-start') || '') >= today.slice(0, 8) + '01';
  });
  if (!rows.length || !window.fetch) return;
  var STOP = { the: 1, and: 1, of: 1, at: 1, usaw: 1, meet: 1, open: 1, classic: 1, wa: 1, or: 1, ak: 1 };
  function words(s) {
    return (String(s).toLowerCase().replace(/\b20\d\d\b/g, ' ').match(/[a-z]+/g) || []).filter(function (w) { return !STOP[w] && w.length > 2; });
  }
  fetch('data/sport80-events.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
    var ev = [];
    Object.keys(d.lists || {}).forEach(function (k) { ev = ev.concat(d.lists[k]); });
    ev = ev.concat((d.unlisted || []).filter(function (e) { return e.link; }));
    rows.forEach(function (row) {
      var start = row.getAttribute('data-start'), a = row.querySelector('a.ev-link');
      var name = (row.querySelector('.ev-name') || {}).textContent || '', meta = (row.querySelector('.ev-meta') || {}).textContent || '';
      var best = null, score = 0, mine = words(name);
      ev.forEach(function (e) {
        if (e.start !== start || !e.link) return;
        var theirs = words(e.name), both = mine.filter(function (w) { return theirs.indexOf(w) >= 0; }).length;
        var s = both / Math.max(1, Math.min(mine.length, theirs.length));
        if (e.city && (name + ' ' + meta).toLowerCase().indexOf(e.city.toLowerCase()) >= 0) s += 0.5;
        if (s > score) { best = e; score = s; }
      });
      if (!best || score < 0.5) return;
      if (LIST.test(a.getAttribute('href') || '')) {
        a.setAttribute('href', best.link);
        a.textContent = best.linkLabel + ' →';
        if (/^mailto:/.test(best.link)) { a.removeAttribute('target'); a.removeAttribute('rel'); }
      }
      // the meet's own website as a second link, when it isn't already the main one
      if (best.siteLink && !row.querySelector('a.ev-site')) {
        var wrap = document.createElement('div'); wrap.className = 'ev-links';
        a.parentNode.insertBefore(wrap, a); wrap.appendChild(a);
        var w = document.createElement('a');
        w.className = 'ev-link muted ev-site'; w.href = best.siteLink; w.target = '_blank'; w.rel = 'noopener';
        w.textContent = 'Meet website →'; wrap.appendChild(w);
      }
    });
  }).catch(function () { });
})();
