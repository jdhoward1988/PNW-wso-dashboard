/**
 * PNW WSO — "Add Your Event" form: email each organizer a link to edit their submission.
 *
 * The calendar page posts submissions straight to the Google Form, so organizers never see
 * Google's own "Edit your response" link. This script sends it to them by email instead.
 * Edits update the same row in the response sheet, so Upcoming Local Events shows the change
 * on the next page load.
 *
 * Organizers get a branded HTML email (plain-text version included for mail apps that need it).
 *
 * Install (once), from the "Add Your Event" form itself:
 *   Form editor → ⋮ (More) → Apps Script → replace the code with this file → Save
 *   → choose setup in the function menu → Run → allow the permissions it asks for.
 * setup() turns on response editing and adds the on-submit email. Running it again is safe.
 *
 * listEditLinks() — logs the edit link for every existing submission (View → Logs), so you can
 *   send one to an organizer who submitted before this was installed. It emails no one.
 */

var SENDER_NAME = 'PNW WSO';
var REPLY_TO = 'jdhoward1988@gmail.com';
var CALENDAR_URL = 'https://jdhoward1988.github.io/PNW-wso-dashboard/#interest';

function setup() {
  var form = FormApp.getActiveForm();
  form.setAllowResponseEdits(true);
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'onEventSubmit'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onEventSubmit').forForm(form).onFormSubmit().create();
  Logger.log('Ready: response editing is on and organizers will be emailed their edit link.');
}

function onEventSubmit(e) {
  var r = e.response;
  var info = details_(r);
  if (!info.email) return; // no contact email given; nothing to send
  var isEdit = r.getTimestamp().getTime() - firstTimestamp_(r) > 60000;
  var subject = (isEdit ? 'Updated: ' : 'Submitted: ') + (info.name || 'your event') + ' (PNW WSO Upcoming Local Events)';
  var editUrl = r.getEditResponseUrl();
  var body =
    'Thanks' + (isEdit ? ' for updating your event.' : ' for adding your event to the PNW WSO calendar.') + '\n\n' +
    (info.name ? 'Event: ' + info.name + '\n' : '') +
    (info.date ? 'Date: ' + info.date + '\n' : '') +
    '\nNeed to change the date, details or contact info later? Use your personal edit link:\n' + editUrl + '\n\n' +
    'Keep this link private: anyone with it can change your listing. Changes show up in Upcoming Local Events ' +
    'within a minute: ' + CALENDAR_URL + '\n\n' +
    'To remove a listing, reply to this email.\n\n— PNW WSO';
  MailApp.sendEmail({
    to: info.email, subject: subject, body: body, htmlBody: emailHtml_(info, editUrl, isEdit),
    name: SENDER_NAME, replyTo: REPLY_TO
  });
}

// ---------- HTML email, styled like the calendar site ----------
// PNW WSO brand palette: navy #08172A, blue #3C78BD, green #4CAB48, gold #E0B025, grey #CECECD,
// off-white #F8F8F8. Poppins headings / Inter body / IBM Plex Mono dates, with safe fallbacks
// (most mail apps don't load web fonts). Inline styles + tables so Gmail and Outlook keep the layout.
var LOGO_URL = 'https://jdhoward1988.github.io/PNW-wso-dashboard/assets/pnw-wso-mark-180.png';

function emailHtml_(info, editUrl, isEdit) {
  var H = "'Poppins','Segoe UI',Helvetica,Arial,sans-serif";
  var B = "'Inter','Segoe UI',Helvetica,Arial,sans-serif";
  var M = "'IBM Plex Mono',Menlo,Consolas,monospace";
  var where = [info.venue, [info.city, info.state].filter(String).join(', ')].filter(String).join(' · ');
  var tag = function (t) {
    return '<span style="display:inline-block;font:600 10px ' + B + ';letter-spacing:.07em;text-transform:uppercase;' +
      'padding:4px 10px;border-radius:999px;border:1.5px solid #CECECD;color:#465366;margin:8px 6px 0 0;white-space:nowrap;">' + esc_(t) + '</span>';
  };
  return '' +
  '<!doctype html><html><body style="margin:0;padding:0;background:#F8F8F8;">' +
  '<div style="display:none;max-height:0;overflow:hidden;">Your private link to edit ' + esc_(info.name || 'your event') + '.</div>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F8F8;"><tr><td align="center" style="padding:24px 12px;">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #CECECD;border-radius:14px;overflow:hidden;">' +

  // header band
  '<tr><td style="background:#08172A;padding:18px 24px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="padding-right:12px;"><img src="' + LOGO_URL + '" width="44" height="44" alt="" style="display:block;border:0;"></td>' +
    '<td style="font:700 15px/1.15 ' + H + ';color:#F8F8F8;letter-spacing:.02em;">PNW WSO' +
      '<div style="font:500 10.5px ' + B + ';color:#CECECD;letter-spacing:.06em;text-transform:uppercase;margin-top:3px;">Upcoming Local Events</div></td>' +
    '</tr></table></td></tr>' +
  '<tr><td style="height:4px;line-height:4px;font-size:0;background:#E0B025;">&nbsp;</td></tr>' +

  // intro
  '<tr><td style="padding:28px 28px 6px;">' +
    '<div style="font:700 22px/1.25 ' + H + ';color:#08172A;">' + (isEdit ? 'Your event was updated' : 'Your event is on the calendar') + '</div>' +
    '<div style="font:400 14px/1.55 ' + B + ';color:#465366;margin-top:8px;">' +
      (isEdit ? 'Thanks for keeping your listing current. Here it is as it now appears.'
              : 'Thanks for adding your event. Lifters can find it in Upcoming Local Events, and other organizers can avoid scheduling on the same date.') +
    '</div></td></tr>' +

  // event card, like the site's proposed-event rows (dashed green stripe)
  '<tr><td style="padding:16px 28px 4px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #CECECD;border-radius:14px;">' +
    '<tr><td style="border-left:5px dashed #4CAB48;border-radius:14px 0 0 14px;padding:16px 18px;">' +
      (info.date ? '<div style="font:500 12px ' + M + ';color:#465366;">' + esc_(info.date) + '</div>' : '') +
      '<div style="font:600 16px/1.3 ' + H + ';color:#08172A;margin-top:4px;">' + esc_(info.name || 'Your event') + '</div>' +
      (where ? '<div style="font:400 12.5px ' + B + ';color:#465366;margin-top:3px;">' + esc_(where) + '</div>' : '') +
      '<div>' + tag('Proposed') + (info.type ? tag(info.type) : '') + '</div>' +
    '</td></tr></table></td></tr>' +

  // button
  '<tr><td style="padding:22px 28px 6px;">' +
    '<div style="font:600 14px ' + B + ';color:#08172A;margin-bottom:12px;">Need to change the date, details or contact info?</div>' +
    '<a href="' + editUrl + '" style="display:inline-block;background:#08172A;color:#F8F8F8;text-decoration:none;' +
      'font:600 12px ' + B + ';letter-spacing:.12em;text-transform:uppercase;padding:14px 26px;border-radius:999px;">Edit your event &rarr;</a>' +
    '<div style="font:400 12.5px/1.5 ' + B + ';color:#6E7887;margin-top:12px;">This link is just for you: anyone with it can change your listing, so please don\'t share it. ' +
      'Changes show up within a minute.</div>' +
  '</td></tr>' +

  // secondary link
  '<tr><td style="padding:14px 28px 26px;">' +
    '<a href="' + CALENDAR_URL + '" style="font:600 12.5px ' + B + ';color:#08172A;text-decoration:none;border-bottom:1.5px solid #3C78BD;">See Upcoming Local Events &rarr;</a>' +
  '</td></tr>' +

  // footer
  '<tr><td style="background:#F8F8F8;border-top:1px solid #CECECD;padding:16px 28px;font:400 12px/1.5 ' + B + ';color:#6E7887;">' +
    'To remove your listing, just reply to this email.<br>Pacific Northwest Weightlifting State Organization &middot; Alaska &middot; Oregon &middot; Washington' +
  '</td></tr>' +

  '</table></td></tr></table></body></html>';
}

function esc_(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function listEditLinks() {
  FormApp.getActiveForm().getResponses().forEach(function (r) {
    var info = details_(r);
    Logger.log((info.date || '?') + ' | ' + (info.name || '(no name)') + ' | ' + (info.email || '(no email)') + '\n  ' + r.getEditResponseUrl());
  });
}

// Pull the event name ("Name (Of Event)"), date ("Planned Date") and "Contact Email" out of a
// response by question title/type, so it keeps working if the wording changes slightly.
function details_(r) {
  var out = { name: '', date: '', email: '', venue: '', city: '', state: '', type: '' };
  r.getItemResponses().forEach(function (ir) {
    var item = ir.getItem(), title = item.getTitle().toLowerCase().trim(), v = ir.getResponse();
    if (typeof v !== 'string') return;
    v = v.trim();
    if (!out.email && /email/.test(title) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) out.email = v;
    else if (!out.date && item.getType() === FormApp.ItemType.DATE) out.date = niceDate_(v);
    else if (!out.name && /name \(of event\)|name of (the )?event|event name|meet name/.test(title)) out.name = v;
    else if (title === 'venue') out.venue = v;
    else if (title === 'city') out.city = v;
    else if (title === 'state') out.state = v;
    else if (title === 'event type') out.type = v;
  });
  return out;
}

// "2026-11-21" -> "Sat, Nov 21, 2026"
function niceDate_(v) {
  var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  return Utilities.formatDate(new Date(+m[1], +m[2] - 1, +m[3], 12), 'America/Los_Angeles', 'EEE, MMM d, yyyy');
}

// An edit keeps the same response id but gets a new timestamp, so remember when each
// response was first submitted to tell a new submission from an edit.
function firstTimestamp_(r) {
  var props = PropertiesService.getScriptProperties(), key = 'first_' + r.getId();
  var seen = props.getProperty(key);
  if (seen) return Number(seen);
  props.setProperty(key, String(r.getTimestamp().getTime()));
  return r.getTimestamp().getTime();
}
