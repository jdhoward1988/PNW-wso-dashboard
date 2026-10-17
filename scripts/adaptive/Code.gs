/**
 * PNW WSO — Adaptive athlete opt-in (Google Apps Script)
 *
 * setup()  — run once: creates the opt-in Google Form and its private response sheet,
 *            adds the reviewer columns, and remembers both IDs.
 * doGet()  — web app (Execute as: Me, Who has access: Anyone). Returns ONLY rows the
 *            WSO has approved, and ONLY fields that appear publicly on the rankings page:
 *            name, club, USAW profile id (if known) and the adaptive category if the
 *            athlete chose to show it. Emails, submitter, consent records and notes
 *            never leave the sheet.
 *
 * Review: in the response sheet put Y in "Approved" for each entry you accept. Clear it
 * (or delete the row) to remove someone; the site drops them at the next Monday update.
 * Fill "USAW profile ID" if the athlete didn't give a profile link and the name is
 * ambiguous; otherwise the Monday update matches the name against the rankings.
 */

const CONTACT = 'jdhoward1988@gmail.com';
const Q = {
  name: 'Athlete name (as it appears in USA Weightlifting results)',
  club: 'Club',
  link: 'USAW rankings profile link (optional)',
  cat: 'USA Weightlifting adaptive category',
  show: 'Show the adaptive category on the rankings page?',
  who: 'Who is submitting this form?',
  email: 'Contact email',
  consent: 'Consent'
};
const CATS = {
  'Physical Disability': 'PD',
  'Visual Impairment': 'VI',
  'Deaf, Deafened, or Hard of Hearing': 'DHH',
  'Intellectual Impairment': 'ID'
};
const SHOW_YES = 'Yes, show the category';
const SHOW_NO = 'No, show "Adaptive" only';
const REVIEW_COLS = ['Approved', 'USAW profile ID', 'Reviewer notes'];

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_ID')) throw new Error('Already set up. Form: ' + FormApp.openById(props.getProperty('FORM_ID')).getPublishedUrl());

  const form = FormApp.create('PNW WSO Rankings: Adaptive Athlete Opt-In');
  form.setDescription(
    'USA Weightlifting\'s public results don\'t mark adaptive athletes, so the PNW WSO Rankings page shows the ' +
    'Adaptive badge only for athletes who opt in here. Your entry is reviewed by the PNW WSO before it appears, ' +
    'and the page updates on Mondays.\n\n' +
    'What appears publicly: the Adaptive badge next to the name already shown in the rankings, plus your adaptive ' +
    'category only if you choose to show it. Your email and the other answers stay private with the PNW WSO.\n\n' +
    'If the athlete is under 18, a parent or guardian must submit this form or give permission. ' +
    'To be removed at any time, email ' + CONTACT + '.'
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setConfirmationMessage('Thanks! The PNW WSO will review this and the badge will appear on the rankings page after the next Monday update. Questions or changes: ' + CONTACT);

  form.addTextItem().setTitle(Q.name).setRequired(true);
  form.addTextItem().setTitle(Q.club).setHelpText('As listed in USAW results, if any.');
  form.addTextItem().setTitle(Q.link)
    .setHelpText('On the PNW WSO Rankings page, find the athlete and copy the "Profile →" link. This makes sure we match the right person.');
  form.addMultipleChoiceItem().setTitle(Q.cat).setChoiceValues(Object.keys(CATS)).setRequired(true)
    .setHelpText('The categories USAW uses for adaptive entries at national events.');
  form.addMultipleChoiceItem().setTitle(Q.show).setChoiceValues([SHOW_NO, SHOW_YES]).setRequired(true);
  form.addMultipleChoiceItem().setTitle(Q.who)
    .setChoiceValues(['The athlete', 'Parent or guardian of the athlete', 'Coach, with the athlete\'s (or guardian\'s) permission'])
    .setRequired(true);
  form.addTextItem().setTitle(Q.email).setRequired(true)
    .setHelpText('Not published. Used only to confirm the listing or answer questions.')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addCheckboxItem().setTitle(Q.consent).setRequired(true).setChoiceValues([
    'I agree that this athlete may be shown publicly as an adaptive athlete on the PNW WSO rankings page, ' +
    'and I understand they can be removed at any time by emailing ' + CONTACT + '.'
  ]);

  const ss = SpreadsheetApp.create('PNW WSO Adaptive Opt-In (responses, private)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);

  const sheet = responseSheet_(ss);
  const lastCol = sheet.getLastColumn();
  sheet.getRange(1, lastCol + 1, 1, REVIEW_COLS.length).setValues([REVIEW_COLS]).setFontWeight('bold').setBackground('#FFF4CC');
  sheet.getRange(2, lastCol + 1, sheet.getMaxRows() - 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Y', 'N'], true).setAllowInvalid(false).build());
  // Remove the blank default tab if it is still there
  ss.getSheets().filter(s => s.getSheetId() !== sheet.getSheetId() && s.getLastRow() === 0).forEach(s => ss.deleteSheet(s));

  props.setProperties({ FORM_ID: form.getId(), SHEET_ID: ss.getId() });
  Logger.log('FORM_URL ' + form.getPublishedUrl());
  Logger.log('SHEET_URL ' + ss.getUrl());
}

function responseSheet_(ss) {
  return ss.getSheets().find(s => s.getFormUrl()) || ss.getSheets()[0];
}

function doGet() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  const values = responseSheet_(ss).getDataRange().getValues();
  const head = values.shift().map(String);
  const col = t => head.indexOf(t);
  const out = [];
  for (const r of values) {
    if (String(r[col('Approved')]).trim().toUpperCase() !== 'Y') continue;
    const consent = String(r[col(Q.consent)] || '');
    if (!consent) continue;
    let id = String(r[col('USAW profile ID')] || '').trim();
    if (!id) {
      const m = String(r[col(Q.link)] || '').match(/member\/(\d+)/);
      if (m) id = m[1];
    }
    const showCat = String(r[col(Q.show)]) === SHOW_YES;
    out.push({
      name: String(r[col(Q.name)] || '').trim(),
      club: String(r[col(Q.club)] || '').trim(),
      id: /^\d+$/.test(id) ? Number(id) : null,
      category: showCat ? (CATS[String(r[col(Q.cat)])] || '') : ''
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ updated: new Date().toISOString(), athletes: out }))
    .setMimeType(ContentService.MimeType.JSON);
}
