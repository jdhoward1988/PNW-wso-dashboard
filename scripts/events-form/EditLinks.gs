/**
 * PNW WSO — "Add Your Event" form: email each organizer a link to edit their submission.
 *
 * The calendar page posts submissions straight to the Google Form, so organizers never see
 * Google's own "Edit your response" link. This script sends it to them by email instead.
 * Edits update the same row in the response sheet, so Upcoming Local Events shows the change
 * on the next page load.
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
  MailApp.sendEmail({ to: info.email, subject: subject, body: body, name: SENDER_NAME, replyTo: REPLY_TO });
}

function listEditLinks() {
  FormApp.getActiveForm().getResponses().forEach(function (r) {
    var info = details_(r);
    Logger.log((info.date || '?') + ' | ' + (info.name || '(no name)') + ' | ' + (info.email || '(no email)') + '\n  ' + r.getEditResponseUrl());
  });
}

// Pull the event name, date and contact email out of a response by question type/title,
// so it keeps working if question wording changes slightly.
function details_(r) {
  var out = { name: '', date: '', email: '' };
  r.getItemResponses().forEach(function (ir) {
    var item = ir.getItem(), title = item.getTitle().toLowerCase(), v = ir.getResponse();
    if (typeof v !== 'string') return;
    if (!out.email && /email/.test(title) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())) out.email = v.trim();
    else if (!out.date && item.getType() === FormApp.ItemType.DATE) out.date = v;
    else if (!out.name && /name of (the )?event|event name|meet name/.test(title)) out.name = v.trim();
  });
  return out;
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
