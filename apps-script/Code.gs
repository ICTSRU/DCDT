/**
 * SRU ICTD · Data Center Digital Twin — Backend v2.9
 * Google Apps Script bound to a Google Sheet. Serves Index.html through HtmlService.
 *
 * Sheets (created by setup()):
 *   Settings      Key / Value           room name and thresholds
 *   Racks         one row per rack      (RackID, Row, Position, TotalU, PowerCapW, InletTempC ...)
 *   Devices       one row per device    (RackID, StartU, HeightU, PowerW, IP, Serial ...)
 *   AllowedUsers  Email / Role / Name / Active     role = admin | viewer
 *   AccessLog     Date / Time / Email / Role / Result   one row per page open
 *   ChangeLog     every edit made from the Settings page
 *
 * Access: only @sr.edu.sa accounts. ACCESS_MODE 'LIST' = only AllowedUsers rows,
 *         'DOMAIN' = any @sr.edu.sa account as viewer (admins still come from AllowedUsers).
 * Deploy: Execute as "Me" (the owner), Who has access "Anyone within sr.edu.sa".
 */

const APP_VERSION = '2.9';
const APP_TITLE = 'التوأم الرقمي لمركز البيانات';
const ACCESS_MODE = 'LIST';          // 'LIST' | 'DOMAIN'
const DOMAIN = 'sr.edu.sa';
const TZ = 'Asia/Riyadh';
const MAX_PHOTOS = 4;                       // photos per rack
const MAX_PHOTO_B64 = 5600000;               // ~4 MB image after base64
const PHOTO_FOLDER_NAME = 'DC Digital Twin Photos';
const MAX_RACKS = 200;

const T = { settings: 'Settings', racks: 'Racks', devices: 'Devices', allowed: 'AllowedUsers', access: 'AccessLog', changes: 'ChangeLog' };

const HEAD = {
  Settings: ['Key', 'Value'],
  Racks: ['RackID', 'Name', 'Row', 'Position', 'TotalU', 'PowerCapW', 'InletTempC', 'ReadingAt', 'Notes', 'UpdatedAt', 'UpdatedBy', 'Photos'],
  Devices: ['DeviceID', 'RackID', 'Name', 'Type', 'Status', 'StartU', 'HeightU', 'PowerW', 'Vendor', 'Model', 'Serial', 'AssetTag', 'IP', 'Owner', 'Notes', 'UpdatedAt', 'UpdatedBy'],
  AllowedUsers: ['Email', 'Role', 'Name', 'Active'],
  AccessLog: ['Date', 'Time', 'Email', 'Role', 'Result'],
  ChangeLog: ['Timestamp', 'User', 'Action', 'Entity', 'ID', 'Details']
};

// Columns stored as plain text so Sheets never turns "01", "10.0.0.1" or dates into numbers.
const TEXT_COLS = {
  Settings: ['Key'],
  Racks: ['RackID', 'Name', 'Row', 'ReadingAt', 'Notes', 'UpdatedAt', 'UpdatedBy', 'Photos'],
  Devices: ['DeviceID', 'RackID', 'Name', 'Type', 'Status', 'Vendor', 'Model', 'Serial', 'AssetTag', 'IP', 'Owner', 'Notes', 'UpdatedAt', 'UpdatedBy'],
  AllowedUsers: ['Email', 'Role', 'Name', 'Active'],
  AccessLog: ['Date', 'Time', 'Email', 'Role', 'Result'],
  ChangeLog: ['Timestamp', 'User', 'Action', 'Entity', 'ID', 'Details']
};

const DEFAULTS = {
  RoomName: 'قاعة التجربة / Pilot Room',
  DefaultTotalU: 42,
  DefaultPowerCapW: 6000,
  PlanPowerPct: 80,
  PowerWarnPct: 80,
  PowerCritPct: 90,
  PlanTempC: 26,
  TempWarnC: 27,
  TempCritC: 32,
  SpaceWarnPct: 75,
  SpaceCritPct: 90,
  StaleMinutes: 0
};
// key: [min, max, mustBeInteger]
const NUM_RULES = {
  DefaultTotalU: [1, 60, true], DefaultPowerCapW: [100, 100000, true],
  PlanPowerPct: [1, 100, false], PowerWarnPct: [1, 100, false], PowerCritPct: [1, 150, false],
  PlanTempC: [10, 45, false], TempWarnC: [10, 50, false], TempCritC: [10, 60, false],
  SpaceWarnPct: [1, 100, false], SpaceCritPct: [1, 100, false], StaleMinutes: [0, 1440, true]
};

const TYPES = ['server', 'storage', 'network', 'security', 'other'];
const STATUSES = ['Active', 'Planned', 'Maintenance', 'Decommissioned'];

// ───────────────────────── Setup and menu ─────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('DC Digital Twin')
    .addItem('1) Setup sheets', 'setup')
    .addItem('2) Load sample data (empty system only)', 'seedSample')
    .addToUi();
}

/**
 * v2.4: power is stored in watts. Converts sheets created by v2.0-v2.3 (kW) once:
 * renames the columns/key (PowerCapKW, PowerKW, DefaultPowerCapKW) and multiplies the values by 1000.
 * Safe to run repeatedly; it is guarded by the POWER_UNIT script property.
 */
function migrateWatts_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('POWER_UNIT') === 'W') return;
  [[T.racks, 'PowerCapKW', 'PowerCapW'], [T.devices, 'PowerKW', 'PowerW']].forEach(function (m) {
    const sh = sheet_(m[0]);
    if (sh.getLastRow() < 1) return;
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], i = head.indexOf(m[1]);
    if (i < 0) return;
    sh.getRange(1, i + 1).setValue(m[2]);
    const n = sh.getLastRow() - 1;
    if (n > 0) {
      const rng = sh.getRange(2, i + 1, n, 1);
      rng.setValues(rng.getValues().map(function (r) { return [(r[0] === '' || isNaN(Number(r[0]))) ? r[0] : Math.round(Number(r[0]) * 1000)]; }));
    }
  });
  const st = sheet_(T.settings);
  if (st.getLastRow() > 1) {
    const vals = st.getRange(2, 1, st.getLastRow() - 1, 2).getValues();
    vals.forEach(function (r, k) {
      if (String(r[0]) === 'DefaultPowerCapKW') {
        st.getRange(k + 2, 1, 1, 2).setValues([['DefaultPowerCapW', Math.round(Number(r[1]) * 1000) || DEFAULTS.DefaultPowerCapW]]);
      }
    });
  }
  props.setProperty('POWER_UNIT', 'W');
}

/** v2.5: adds the Photos column to an existing Racks sheet (once). */
function ensurePhotosColumn_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('PHOTOS_COL') === '1') return;
  const sh = sheet_(T.racks);
  if (sh.getLastRow() >= 1) {
    const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), HEAD.Racks.length)).getValues()[0];
    if (head.indexOf('Photos') < 0) {
      const col = HEAD.Racks.indexOf('Photos') + 1;
      sh.getRange(1, col).setValue('Photos').setFontWeight('bold').setBackground('#501e8c').setFontColor('#ffffff');
      if (sh.getMaxRows() > 1) sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    }
  }
  props.setProperty('PHOTOS_COL', '1');
}

/** Run once from the editor: creates every sheet, headers, defaults and the owner as admin. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  migrateWatts_();
  ensurePhotosColumn_();
  Object.keys(HEAD).forEach(function (n) { ensureSheet_(n); });
  const have = readTable_(T.settings).map(function (r) { return r.Key; });
  const add = [];
  Object.keys(DEFAULTS).forEach(function (k) { if (have.indexOf(k) < 0) add.push({ Key: k, Value: DEFAULTS[k] }); });
  appendRows_(T.settings, add);
  try { getPhotoFolder_(); } catch (e) { /* Drive permission is requested here; photos stay disabled until granted */ }
  const owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const users = readTable_(T.allowed);
  if (owner && !users.some(function (r) { return String(r.Email).toLowerCase() === owner; })) {
    appendRows_(T.allowed, [{ Email: owner, Role: 'admin', Name: 'Owner', Active: 'yes' }]);
  }
  ss.toast('Setup complete. Add users to AllowedUsers, then deploy as a web app.', 'DC Digital Twin', 8);
}

/** Menu action: loads the sample room only when no rack exists. */
function seedSample() {
  setup();
  const owner = { email: (Session.getEffectiveUser().getEmail() || 'setup'), role: 'admin' };
  const n = withLock_(function () { return loadSample_(owner); });
  SpreadsheetApp.getActive().toast(n + ' racks loaded.', 'DC Digital Twin', 6);
}

// ───────────────────────── Web app entry ─────────────────────────

function doGet() {
  const u = currentUser_();
  try { logAccess_(u, u.allowed ? 'OK' : 'DENIED'); } catch (err) { /* logging must never block the page */ }
  const out = u.allowed
    ? HtmlService.createHtmlOutputFromFile('Index')
    : HtmlService.createHtmlOutput(deniedHtml_(u.email));
  return out.setTitle(APP_TITLE).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function deniedHtml_(email) {
  const e = String(email || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  return '<div style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:60px auto;padding:24px;border:1px solid #d8cdea;border-top:4px solid #501e8c;border-radius:4px;direction:rtl;text-align:right">' +
    '<h2 style="color:#501e8c;margin:0 0 8px">لا تملك صلاحية الدخول</h2>' +
    '<p>سجّل الدخول بحسابك الجامعي (@' + DOMAIN + ') وتأكد من إضافته إلى قائمة المستخدمين المصرّح لهم.' + (e ? ' الحساب الحالي: <b dir="ltr">' + e + '</b>' : '') + '</p>' +
    '<h2 dir="ltr" style="color:#501e8c;margin:16px 0 8px;text-align:left">Access denied</h2>' +
    '<p dir="ltr" style="text-align:left">Sign in with your university account (@' + DOMAIN + ') and ask ITOC to add you to the allowed users list.</p></div>';
}

// ───────────────────────── Users and access ─────────────────────────

function currentUser_() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const owner = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  let role = null, blocked = false;
  if (email) {
    const row = readTable_(T.allowed).filter(function (r) { return String(r.Email).toLowerCase() === email; })[0];
    if (row) {
      if (/^(no|false|0)$/i.test(String(row.Active).trim())) blocked = true;
      else role = String(row.Role).toLowerCase() === 'admin' ? 'admin' : 'viewer';
    }
    if (email === owner) role = 'admin';
    if (!role && !blocked && ACCESS_MODE === 'DOMAIN' && email.slice(-(DOMAIN.length + 1)) === '@' + DOMAIN) role = 'viewer';
  }
  return { email: email, role: role, allowed: !!role };
}

function requireUser_(admin) {
  const u = currentUser_();
  if (!u.allowed) fail_('E_FORBIDDEN');
  if (admin && u.role !== 'admin') fail_('E_ADMIN');
  return u;
}

function logAccess_(u, result) {
  const now = new Date();
  appendRows_(T.access, [{ Date: Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), Time: Utilities.formatDate(now, TZ, 'HH:mm:ss'), Email: u.email || '(unknown)', Role: u.role || '', Result: result }]);
}

// ───────────────────────── Public API (called from the page) ─────────────────────────

function api_bootstrap() {
  const u = requireUser_(false);
  const pr = PropertiesService.getScriptProperties();
  if (pr.getProperty('POWER_UNIT') !== 'W' || pr.getProperty('PHOTOS_COL') !== '1') try { withLock_(function () { migrateWatts_(); ensurePhotosColumn_(); }); } catch (e) { /* never block the dashboard; retried on the next load */ }
  const s = snapshot_();
  s.version = APP_VERSION;
  s.user = { email: u.email, role: u.role };
  return s;
}

function api_saveSettings(s) {
  const u = requireUser_(true);
  return withLock_(function () {
    s = s || {};
    const out = { RoomName: String(s.RoomName || '').trim().slice(0, 60) || DEFAULTS.RoomName };
    Object.keys(NUM_RULES).forEach(function (k) {
      const r = NUM_RULES[k], n = Number(s[k]);
      if (s[k] === '' || s[k] === null || s[k] === undefined || !isFinite(n) || n < r[0] || n > r[1] || (r[2] && Math.floor(n) !== n)) fail_('E_SET', k);
      out[k] = n;
    });
    if (out.PowerWarnPct >= out.PowerCritPct || out.TempWarnC >= out.TempCritC || out.SpaceWarnPct >= out.SpaceCritPct) fail_('E_THRESH');
    const rows = readTable_(T.settings), add = [];
    Object.keys(out).forEach(function (k) {
      const ex = rows.filter(function (r) { return r.Key === k; })[0];
      if (ex) writeRow_(T.settings, ex._row, { Key: k, Value: out[k] }); else add.push({ Key: k, Value: out[k] });
    });
    appendRows_(T.settings, add);
    log_(u, 'EDIT', 'Settings', '-', 'thresholds and room name');
    return snapshot_();
  });
}

function api_saveRack(r, isNew) {
  const u = requireUser_(true);
  return withLock_(function () {
    r = r || {};
    const id = String(r.RackID || '').trim();
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(id)) fail_('E_RACK_ID');
    const row = String(r.Row || '').trim();
    if (!row || row.length > 6) fail_('E_ROW');
    const pos = int_(r.Position, 1, 99, 'E_POS');
    const totalU = int_(r.TotalU, 1, 60, 'E_TOTALU');
    const cap = num_(r.PowerCapW, 100, 100000, 'E_CAP');
    let inlet = '';
    if (r.InletTempC !== '' && r.InletTempC !== null && r.InletTempC !== undefined) inlet = num_(r.InletTempC, 0, 60, 'E_TEMP');

    const racks = readTable_(T.racks), devs = readTable_(T.devices);
    const cur = racks.filter(function (x) { return String(x.RackID) === id; })[0];
    if (isNew && cur) fail_('E_RACK_DUP', id);
    if (!isNew && !cur) fail_('E_RACK_NONE', id);
    if (isNew && racks.length >= MAX_RACKS) fail_('E_LIMIT');
    const clash = racks.filter(function (x) { return String(x.RackID) !== id && String(x.Row) === row && Number(x.Position) === pos; })[0];
    if (clash) fail_('E_POS_DUP', clash.RackID);
    const ends = devs.filter(function (d) { return String(d.RackID) === id && d.Status !== 'Decommissioned'; })
      .map(function (d) { return Number(d.StartU) + Number(d.HeightU) - 1; });
    const maxEnd = ends.length ? Math.max.apply(null, ends) : 0;
    if (maxEnd > totalU) fail_('E_RACK_SHRINK', maxEnd);

    const now = stamp_();
    let readingAt = cur ? String(cur.ReadingAt || '') : '';
    if (inlet === '') readingAt = '';
    else if (!cur || String(cur.InletTempC) === '' || Number(cur.InletTempC) !== inlet) readingAt = now;
    const obj = {
      RackID: id, Name: String(r.Name || id).trim().slice(0, 40), Row: row, Position: pos, TotalU: totalU,
      PowerCapW: cap, InletTempC: inlet, ReadingAt: readingAt, Notes: String(r.Notes || '').slice(0, 200),
      UpdatedAt: now, UpdatedBy: u.email, Photos: cur ? String(cur.Photos || '') : ''
    };
    if (cur) writeRow_(T.racks, cur._row, obj); else appendRows_(T.racks, [obj]);
    log_(u, cur ? 'EDIT' : 'ADD', 'Rack', id, row + '-' + pos + ', ' + totalU + 'U, ' + cap + 'W');
    return snapshot_();
  });
}

function api_deleteRack(id) {
  const u = requireUser_(true);
  return withLock_(function () {
    id = String(id || '');
    const cur = readTable_(T.racks).filter(function (x) { return String(x.RackID) === id; })[0];
    if (!cur) fail_('E_RACK_NONE', id);
    const devRows = readTable_(T.devices).filter(function (d) { return String(d.RackID) === id; }).map(function (d) { return d._row; });
    String(cur.Photos || '').split(',').filter(Boolean).forEach(trashPhoto_);
    deleteRows_(T.devices, devRows);
    deleteRows_(T.racks, [cur._row]);
    log_(u, 'DELETE', 'Rack', id, devRows.length + ' devices removed with it');
    return snapshot_();
  });
}

// ───────────────────────── Rack photos (stored privately in Drive, served through this app) ─────────────────────────

function getPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* fall through and recreate */ }
  }
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function trashPhoto_(fileId) {
  try { DriveApp.getFileById(String(fileId)).setTrashed(true); } catch (e) { /* already gone or no Drive access */ }
}

function photoIds_(rack) { return String(rack.Photos || '').split(',').filter(Boolean); }

function drive_(fn) {
  try { return fn(); } catch (e) {
    if (/^E_/.test(String(e && e.message))) throw e;
    fail_('E_PHOTO_DRIVE', String((e && e.message) || e).slice(0, 120));
  }
}

/** Admin only. dataUrl: "data:image/jpeg;base64,..." (the page resizes to <= 1600 px first). */
function api_addRackPhoto(rackId, dataUrl) {
  const u = requireUser_(true);
  rackId = String(rackId || '');
  dataUrl = String(dataUrl || '');
  const m = /^data:image\/(jpeg|png|webp);base64,/.exec(dataUrl.slice(0, 40));
  if (!m) fail_('E_PHOTO');
  const b64 = dataUrl.slice(m[0].length);
  if (b64.length > MAX_PHOTO_B64) fail_('E_PHOTO_SIZE');
  let bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { fail_('E_PHOTO'); }
  const sig = bytes.length > 12 ? bytes : [];
  const okSig = (m[1] === 'jpeg' && sig[0] === -1 && sig[1] === -40) ||
                (m[1] === 'png' && sig[0] === -119 && sig[1] === 80) ||
                (m[1] === 'webp' && sig[0] === 82 && sig[1] === 73);
  if (!okSig) fail_('E_PHOTO');
  return withLock_(function () {
    const cur = readTable_(T.racks).filter(function (x) { return String(x.RackID) === rackId; })[0];
    if (!cur) fail_('E_RACK_NONE', rackId);
    const ids = photoIds_(cur);
    if (ids.length >= MAX_PHOTOS) fail_('E_PHOTO_MAX');
    const mime = 'image/' + m[1], ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const fileId = drive_(function () {
      const blob = Utilities.newBlob(bytes, mime, rackId + '_' + Date.now() + '.' + ext);
      return getPhotoFolder_().createFile(blob).getId();
    });
    ids.push(fileId);
    cur.Photos = ids.join(','); cur.UpdatedAt = stamp_(); cur.UpdatedBy = u.email;
    writeRow_(T.racks, cur._row, cur);
    log_(u, 'ADD', 'RackPhoto', rackId, ids.length + ' photo(s)');
    return snapshot_();
  });
}

/** Any allowed user. Only returns files that are registered on a rack, never arbitrary Drive files. */
function api_getRackPhoto(fileId) {
  requireUser_(false);
  fileId = String(fileId || '');
  const known = readTable_(T.racks).some(function (r) { return photoIds_(r).indexOf(fileId) >= 0; });
  if (!known) fail_('E_PHOTO_NONE');
  return drive_(function () {
    const blob = DriveApp.getFileById(fileId).getBlob();
    return { id: fileId, data: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  });
}

function api_deleteRackPhoto(rackId, fileId) {
  const u = requireUser_(true);
  rackId = String(rackId || ''); fileId = String(fileId || '');
  return withLock_(function () {
    const cur = readTable_(T.racks).filter(function (x) { return String(x.RackID) === rackId; })[0];
    if (!cur) fail_('E_RACK_NONE', rackId);
    const ids = photoIds_(cur);
    if (ids.indexOf(fileId) < 0) fail_('E_PHOTO_NONE');
    cur.Photos = ids.filter(function (x) { return x !== fileId; }).join(',');
    cur.UpdatedAt = stamp_(); cur.UpdatedBy = u.email;
    writeRow_(T.racks, cur._row, cur);
    trashPhoto_(fileId);
    log_(u, 'DELETE', 'RackPhoto', rackId, 'photo removed');
    return snapshot_();
  });
}

function api_generateRacks(cfg) {
  const u = requireUser_(true);
  return withLock_(function () {
    cfg = cfg || {};
    const rows = [];
    (cfg.rows || []).forEach(function (x) { x = String(x).trim(); if (x && rows.indexOf(x) < 0) rows.push(x); });
    if (!rows.length || rows.length > 10) fail_('E_GEN');
    rows.forEach(function (x) { if (!/^[A-Za-z0-9_-]{1,6}$/.test(x)) fail_('E_GEN'); });
    const perRow = int_(cfg.perRow, 1, 30, 'E_GEN');
    const totalU = int_(cfg.totalU, 1, 60, 'E_TOTALU');
    const cap = num_(cfg.powerCapW, 100, 100000, 'E_CAP');
    const racks = readTable_(T.racks);
    const ids = {}, spots = {};
    racks.forEach(function (x) { ids[String(x.RackID)] = 1; spots[String(x.Row) + '|' + Number(x.Position)] = 1; });
    const now = stamp_(), add = [];
    rows.forEach(function (rw) {
      for (let i = 1; i <= perRow; i++) {
        const id = rw + (i < 10 ? '0' + i : String(i));
        if (id.length > 12 || ids[id] || spots[rw + '|' + i]) continue;
        add.push({ RackID: id, Name: id, Row: rw, Position: i, TotalU: totalU, PowerCapW: cap, InletTempC: '', ReadingAt: '', Notes: '', UpdatedAt: now, UpdatedBy: u.email });
        ids[id] = 1; spots[rw + '|' + i] = 1;
      }
    });
    if (racks.length + add.length > MAX_RACKS) fail_('E_LIMIT');
    appendRows_(T.racks, add);
    log_(u, 'ADD', 'Rack', '(generate)', add.length + ' racks, rows ' + rows.join(','));
    const s = snapshot_();
    s.created = add.length;
    return s;
  });
}

function api_saveDevice(d) {
  const u = requireUser_(true);
  return withLock_(function () {
    d = d || {};
    const name = String(d.Name || '').trim();
    if (!name || name.length > 60) fail_('E_DEV_NAME');
    if (TYPES.indexOf(d.Type) < 0) fail_('E_DEV_TYPE');
    if (STATUSES.indexOf(d.Status) < 0) fail_('E_DEV_STATUS');
    const rackId = String(d.RackID || '').trim();
    const rack = readTable_(T.racks).filter(function (r) { return String(r.RackID) === rackId; })[0];
    if (!rack) fail_('E_RACK_NONE', rackId);
    const start = int_(d.StartU, 1, 60, 'E_DEV_U');
    const h = int_(d.HeightU, 1, 60, 'E_DEV_U');
    const kw = (d.PowerW === '' || d.PowerW === null || d.PowerW === undefined) ? 0 : num_(d.PowerW, 0, 50000, 'E_DEV_W');

    const all = readTable_(T.devices);
    const id0 = String(d.DeviceID || '');
    const cur = id0 ? all.filter(function (x) { return String(x.DeviceID) === id0; })[0] : null;
    if (id0 && !cur) fail_('E_DEV_NONE');
    if (d.Status !== 'Decommissioned') {
      if (start + h - 1 > Number(rack.TotalU)) fail_('E_DEV_RANGE', rack.TotalU);
      const clash = all.filter(function (x) {
        return String(x.RackID) === rackId && String(x.DeviceID) !== id0 && x.Status !== 'Decommissioned' &&
          Number(x.StartU) <= start + h - 1 && start <= Number(x.StartU) + Number(x.HeightU) - 1;
      })[0];
      if (clash) fail_('E_DEV_OVERLAP', clash.Name);
    }
    const t = function (v, n) { return String(v === undefined || v === null ? '' : v).trim().slice(0, n); };
    const obj = {
      DeviceID: cur ? id0 : newId_(), RackID: rackId, Name: name, Type: d.Type, Status: d.Status,
      StartU: start, HeightU: h, PowerW: kw, Vendor: t(d.Vendor, 60), Model: t(d.Model, 60), Serial: t(d.Serial, 60),
      AssetTag: t(d.AssetTag, 40), IP: t(d.IP, 45), Owner: t(d.Owner, 80), Notes: t(d.Notes, 300),
      UpdatedAt: stamp_(), UpdatedBy: u.email
    };
    if (cur) writeRow_(T.devices, cur._row, obj); else appendRows_(T.devices, [obj]);
    log_(u, cur ? 'EDIT' : 'ADD', 'Device', obj.DeviceID, name + ' @ ' + rackId + ' U' + start + '-' + (start + h - 1));
    return snapshot_();
  });
}

function api_deleteDevice(id) {
  const u = requireUser_(true);
  return withLock_(function () {
    id = String(id || '');
    const cur = readTable_(T.devices).filter(function (x) { return String(x.DeviceID) === id; })[0];
    if (!cur) fail_('E_DEV_NONE');
    deleteRows_(T.devices, [cur._row]);
    log_(u, 'DELETE', 'Device', id, String(cur.Name) + ' @ ' + cur.RackID);
    return snapshot_();
  });
}

function api_loadSample() {
  const u = requireUser_(true);
  return withLock_(function () {
    loadSample_(u);
    return snapshot_();
  });
}

// ───────────────────────── Snapshot and sample data ─────────────────────────

function snapshot_() {
  const racks = readTable_(T.racks).filter(function (r) { return String(r.RackID) !== ''; }).map(function (r) {
    return {
      RackID: String(r.RackID), Name: String(r.Name || r.RackID), Row: String(r.Row), Position: Number(r.Position) || 1,
      TotalU: Number(r.TotalU) || 42, PowerCapW: Number(r.PowerCapW) || 0,
      InletTempC: (r.InletTempC === '' || isNaN(Number(r.InletTempC))) ? null : Number(r.InletTempC),
      ReadingAt: String(r.ReadingAt || ''), Notes: String(r.Notes || ''),
      Photos: String(r.Photos || '').split(',').filter(Boolean)
    };
  });
  const devices = readTable_(T.devices).filter(function (d) { return String(d.DeviceID) !== ''; }).map(function (d) {
    return {
      DeviceID: String(d.DeviceID), RackID: String(d.RackID), Name: String(d.Name),
      Type: TYPES.indexOf(String(d.Type)) >= 0 ? String(d.Type) : 'other',
      Status: STATUSES.indexOf(String(d.Status)) >= 0 ? String(d.Status) : 'Active',
      StartU: Number(d.StartU) || 1, HeightU: Number(d.HeightU) || 1, PowerW: Number(d.PowerW) || 0,
      Vendor: String(d.Vendor || ''), Model: String(d.Model || ''), Serial: String(d.Serial || ''), AssetTag: String(d.AssetTag || ''),
      IP: String(d.IP || ''), Owner: String(d.Owner || ''), Notes: String(d.Notes || '')
    };
  });
  return { settings: readSettings_(), racks: racks, devices: devices };
}

function readSettings_() {
  const out = Object.assign({}, DEFAULTS);
  readTable_(T.settings).forEach(function (r) {
    const k = String(r.Key);
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, k)) return;
    if (typeof DEFAULTS[k] === 'number') { if (r.Value !== '' && isFinite(Number(r.Value))) out[k] = Number(r.Value); }
    else if (String(r.Value) !== '') out[k] = String(r.Value);
  });
  return out;
}

// name, type, startU, heightU, W, [status], [ip]
const SAMPLE = [
  ['A01', 24.1, [['core-sw-01', 'network', 41, 2, 0.4, 'Active', '10.20.0.1'], ['fw-01', 'security', 39, 2, 0.5], ['esx-01', 'server', 30, 2, 0.9, 'Active', '10.20.1.11'], ['esx-02', 'server', 28, 2, 0.9, 'Active', '10.20.1.12'], ['esx-03', 'server', 26, 2, 0.9], ['san-01', 'storage', 10, 4, 1.4]]],
  ['A02', 24.8, [['esx-04', 'server', 36, 2, 0.9], ['esx-05', 'server', 34, 2, 0.9], ['esx-06', 'server', 32, 2, 0.9], ['esx-07', 'server', 30, 2, 0.9], ['erp-app-01', 'server', 24, 2, 0.8]]],
  ['A03', 28.6, [['esx-08', 'server', 38, 2, 1], ['esx-09', 'server', 36, 2, 1], ['esx-10', 'server', 34, 2, 1], ['gpu-01', 'server', 28, 4, 1.8], ['backup-01', 'storage', 16, 4, 0.8]]],
  ['A04', 23.2, [['esx-11', 'server', 36, 2, 0.9], ['esx-12', 'server', 34, 2, 0.9], ['nas-01', 'storage', 20, 4, 0.8]]],
  ['A05', 23.6, [['tor-sw-05', 'network', 41, 1, 0.2], ['esx-13', 'server', 30, 2, 0.9], ['esx-14', 'server', 28, 2, 0.9], ['mon-01', 'server', 22, 1, 0.3], ['mgmt-sw', 'network', 2, 1, 0.1]]],
  ['B01', 25.2, [['dist-sw-01', 'network', 41, 2, 0.5], ['esx-15', 'server', 32, 2, 0.9], ['esx-16', 'server', 30, 2, 0.9], ['erp-db-02', 'server', 22, 4, 1.6, 'Active', '10.20.2.22']]],
  ['B02', 26.9, [['esx-17', 'server', 38, 2, 1], ['esx-18', 'server', 36, 2, 1], ['esx-19', 'server', 34, 2, 1], ['esx-20', 'server', 32, 2, 1], ['san-02', 'storage', 12, 4, 1.2]]],
  ['B03', 22.0, [['idm-01', 'server', 30, 1, 0.3], ['dns-01', 'server', 29, 1, 0.2], ['jump-01', 'server', 28, 1, 0.3]]],
  ['B04', 24.0, [['esx-21', 'server', 36, 2, 0.9], ['esx-22', 'server', 34, 2, 0.9], ['esx-23', 'server', 32, 2, 0.9], ['tape-01', 'storage', 14, 4, 0.7, 'Planned']]],
  ['B05', 22.8, [['web-01', 'server', 36, 1, 0.3], ['web-02', 'server', 35, 1, 0.3], ['app-02', 'server', 30, 2, 0.7]]]
];

function loadSample_(u) {
  if (readTable_(T.racks).length) fail_('E_NOT_EMPTY');
  const now = stamp_(), s = readSettings_(), racks = [], devs = [];
  SAMPLE.forEach(function (r) {
    racks.push({ RackID: r[0], Name: r[0], Row: r[0].charAt(0), Position: Number(r[0].slice(1)), TotalU: s.DefaultTotalU, PowerCapW: s.DefaultPowerCapW, InletTempC: r[1], ReadingAt: now, Notes: 'Sample data', UpdatedAt: now, UpdatedBy: u.email });
    r[2].forEach(function (d) {
      devs.push({ DeviceID: newId_(), RackID: r[0], Name: d[0], Type: d[1], Status: d[5] || 'Active', StartU: d[2], HeightU: d[3], PowerW: Math.round(d[4] * 1000), IP: d[6] || '', Notes: 'Sample data', UpdatedAt: now, UpdatedBy: u.email });
    });
  });
  appendRows_(T.racks, racks);
  appendRows_(T.devices, devs);
  log_(u, 'ADD', 'Sample', '-', racks.length + ' racks, ' + devs.length + ' devices');
  return racks.length;
}

// ───────────────────────── Sheet helpers ─────────────────────────

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function sheet_(name) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureSheet_(name) {
  const sh = sheet_(name), head = HEAD[name];
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#501e8c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    (TEXT_COLS[name] || []).forEach(function (c) {
      const i = head.indexOf(c) + 1;
      if (i > 0 && sh.getMaxRows() > 1) sh.getRange(2, i, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  }
  return sh;
}

function readTable_(name) {
  const sh = ensureSheet_(name), head = HEAD[name], last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, head.length).getValues(), out = [];
  vals.forEach(function (r, i) {
    if (String(r[0]) === '' ) return;
    const o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = norm_(r[j]); });
    out.push(o);
  });
  return out;
}

function norm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return (v === null || v === undefined) ? '' : v;
}

function rowValues_(name, o) {
  return HEAD[name].map(function (h) { return o[h] === undefined ? '' : o[h]; });
}

function writeRow_(name, rowIdx, o) {
  const sh = sheet_(name);
  sh.getRange(rowIdx, 1, 1, HEAD[name].length).setValues([rowValues_(name, o)]);
}

function appendRows_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name), vals = objs.map(function (o) { return rowValues_(name, o); });
  const start = sh.getLastRow() + 1, need = start + vals.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  sh.getRange(start, 1, vals.length, HEAD[name].length).setValues(vals);
}

function deleteRows_(name, rowNums) {
  const sh = sheet_(name);
  rowNums.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
}

function log_(u, action, entity, id, details) {
  appendRows_(T.changes, [{ Timestamp: stamp_(), User: u.email, Action: action, Entity: entity, ID: id, Details: details }]);
}

// ───────────────────────── Small utilities ─────────────────────────

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function fail_(code, extra) { throw new Error(code + (extra !== undefined ? '|' + extra : '')); }

function int_(v, min, max, code) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !isFinite(n) || Math.floor(n) !== n || n < min || n > max) fail_(code);
  return n;
}

function num_(v, min, max, code) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !isFinite(n) || n < min || n > max) fail_(code);
  return n;
}

function stamp_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function newId_() { return 'D' + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
