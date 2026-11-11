// Draft pages bar: a clearly labeled row of links to the PNW WSO pages still in review.
// It sits under the Calendar / Rankings top bar on every page. To publish a page for real,
// move its link into the top bar and remove it from DRAFT_PAGES below.
(function () {
  var DRAFT_PAGES = [
    ['planner.html', 'Season planner'],
    ['roster.html', 'Qualifying tracker'],
    ['season-bests.html', 'Season bests'],
    ['qualifying-totals.html', '2027 qualifying totals'],
    ['outstanding-athletes.html', 'Outstanding athletes'],
    ['club-standings.html', 'Club standings'],
    ['adaptive-results.html', 'Adaptive results'],
    ['quarterly-update.html', 'Quarterly update'],
    ['referees.html', 'Referees']
  ];
  var top = document.querySelector('.topbar');
  if (!top || document.querySelector('.draftbar')) return;
  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  var css = document.createElement('style');
  css.textContent =
    '.draftbar{background:#FBF4DE;border-bottom:1px solid #E8D9A6;font-family:Inter,system-ui,sans-serif}' +
    '.draftbar .db-in{max-width:var(--wrap,1080px);margin:0 auto;padding:10px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap}' +
    '.draftbar .db-label{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#08172A;white-space:nowrap}' +
    '.draftbar .db-label b{background:#E0B025;color:#08172A;border-radius:999px;padding:3px 9px;letter-spacing:.12em}' +
    '.draftbar .db-label span{font-weight:600;color:#7A5B00;letter-spacing:.06em;text-transform:none;font-size:12px}' +
    '.draftbar nav{display:flex;gap:6px;flex-wrap:wrap}' +
    '.draftbar a{color:#08172A;text-decoration:none;border:1.5px solid #08172A;border-radius:999px;padding:5px 12px;font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;background:transparent}' +
    '.draftbar a:hover{background:#FFFFFF}' +
    '.draftbar a[aria-current="page"]{background:#08172A;color:#F8F8F8}' +
    '.draftbar a:focus-visible{outline:2px solid #E0B025;outline-offset:2px}' +
    // phones: one row that scrolls sideways, so the bar doesn't push the page down
    '@media (max-width:640px){.draftbar .db-in{flex-wrap:nowrap;padding-top:7px;padding-bottom:7px;gap:10px}.draftbar .db-label span{display:none}' +
    '.draftbar nav{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:2px;margin-right:calc(-1*max(16px,env(safe-area-inset-right,0px)));padding-right:16px}.draftbar nav::-webkit-scrollbar{display:none}.draftbar a{padding:7px 12px}}' +
    '@media print{.draftbar{display:none}}';
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.className = 'draftbar';
  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Draft pages in review');
  var links = DRAFT_PAGES.map(function (p) {
    var cur = p[0] === here ? ' aria-current="page"' : '';
    return '<a href="' + p[0] + '"' + cur + '>' + p[1] + '</a>';
  }).join('');
  bar.innerHTML = '<div class="db-in"><span class="db-label"><b>Draft pages</b><span>In review, may change</span></span><nav>' + links + '</nav></div>';
  top.insertAdjacentElement('afterend', bar);
  var cur = bar.querySelector('a[aria-current]'), nav = bar.querySelector('nav');
  if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - nav.offsetLeft - 12;
})();
