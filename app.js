/* NorSmart 3 Stage V HMI redesign concept — interactive prototype (English / Turkish).
   Built on the BYM6 CAN database (can-db.js, generated from BYM6.dbc by tools/dbc2js.py).
   The simulator packs its state into real 8-byte CAN frames using the DBC bit layout.
   Everything the display shows is decoded back from those frames, so a real CAN gateway
   could feed the same screens. Exhaust aftertreatment values are not in BYM6 and stay simulated. */
(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, t, rate, dt) => { const d = t - v; const s = rate * dt; return Math.abs(d) <= s ? t : v + Math.sign(d) * s; };
const now = () => Date.now();
const NA = '––';

/* ---------- i18n ---------- */
const DICT = window.HMI_TR || {};
const MISSING = new Set();
window.__trMissing = MISSING;
const K = (s) => s;
function tx(s, ...a) {
  let o;
  if (S.lang === 'tr') { o = DICT[s]; if (o == null) { MISSING.add(s); o = s.split('|')[0]; } } else o = s.split('|')[0];
  a.forEach((v, i) => { o = o.split('{' + i + '}').join(String(v)); });
  return o;
}
const tf = (x) => (typeof x === 'function' ? x() : tx(x));
const UNIT_TR = { 'km/h': 'km/sa', rpm: 'd/dk', h: 'sa', 'l/h': 'l/sa', s: 'sn', min: 'dk' };
const tu = (u) => (S.lang === 'tr' && UNIT_TR[u] ? UNIT_TR[u] : u);
const f0 = (v) => (v == null ? NA : Math.round(v).toLocaleString('en-US').replace(/,/g, ' '));
const dec = (s) => (S.lang === 'tr' ? String(s).replace('.', ',') : String(s));
const f1 = (v) => (v == null ? NA : dec((Math.round(v * 10) / 10).toFixed(1)));
const f2 = (v) => (v == null ? NA : dec((Math.round(v * 100) / 100).toFixed(2)));
const pct = (n) => (S.lang === 'tr' ? '%' + n : n + ' %');
const hhmm = (t) => { const d = new Date(t + S.tz * 3600e3); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const ago = (t) => { const s = Math.round((now() - t) / 1000); if (s < 45) return tx('just now'); const m = Math.round(s / 60); if (m < 60) return tx('{0} min ago', m); return tx('{0} h ago', Math.round(m / 60)); };
const dur = (ms) => { const s = Math.round(ms / 1000); if (s < 60) return s + ' ' + tu('s'); const m = Math.round(s / 60); if (m < 60) return m + ' ' + tu('min'); return Math.round(m / 60) + ' ' + tu('h'); };
const hexId = (id) => '0x' + id.toString(16).toUpperCase();
/* BYM pictograms (from BYM_PNG.xlsx, converted by tools/pictograms.py). Coloured with currentColor via CSS mask. */
const PIC_V = 'v8';
const pic = (n, cls = '') => (n ? `<i class="pic ${cls}" aria-hidden="true" style="-webkit-mask-image:url(pictograms/${n}.png?${PIC_V});mask-image:url(pictograms/${n}.png?${PIC_V})"></i>` : '');

const sv = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  drive: sv('<path d="M3.5 18a9 9 0 1 1 17 0"/><path d="M12 14l4.5-4.5"/><circle cx="12" cy="14" r="1.2"/>'),
  exhaust: sv('<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>'),
  alerts: sv('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/>', 2.2),
  warn: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/>', 2.4),
  mixer: sv('<path d="M3 16V9h5l2 3"/><ellipse cx="15.5" cy="11" rx="5.5" ry="4" transform="rotate(-12 15.5 11)"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/><path d="M13 9.5l4 3"/>'),
  engine: sv('<path d="M4 10h3l2-3h6l2 3h3v7h-3l-2 2H9l-2-2H4z"/><path d="M12 10v4"/>'),
  service: sv('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  key: sv('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M17 6l3 3"/>'),
  sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  camera: sv('<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>'),
  check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  lock: sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  flame: sv('<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-7.5z"/>'),
  usb: sv('<path d="M12 2v14"/><path d="M8 6l4-4 4 4"/><rect x="8" y="16" width="8" height="6" rx="1"/>'),
  back: sv('<path d="M15 5l-7 7 7 7"/>'),
  close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  play: sv('<path d="M7 4l13 8-13 8z"/>'),
  stop: sv('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
  okc: sv('<circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.5 3.5L17 9"/>', 2.2),
  xc: sv('<circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/>', 2.2),
  arrowL: sv('<path d="M10 5l-7 7 7 7"/><path d="M3 12h18"/>', 2.6),
  arrowR: sv('<path d="M14 5l7 7-7 7"/><path d="M21 12H3"/>', 2.6),
  plug: sv('<path d="M9 2v6M15 2v6"/><path d="M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v4"/>'),
};

const LANGS = [['en', 'English'], ['tr', 'Türkçe']];
const LEVELS = [
  { name: K('Operator'), desc: K('Drive and view everything. No code.') },
  { name: K('Site supervisor'), desc: K('Also clear alarm logs.'), code: '1111' },
  { name: K('Maintenance'), desc: K('Change parameters and calibrate.'), code: '2222' },
  { name: K('Factory'), desc: K('Everything, including serial number.'), code: '3333' },
];
const lvlName = (i) => tx(LEVELS[i].name);

const PARAMS = {
  engine: { title: K('Engine'), items: [
    { id: 'idle', name: K('Idle speed'), unit: 'rpm', min: 650, max: 900, def: 750 },
    { id: 'maxRpm', name: K('Maximum engine speed'), unit: 'rpm', min: 1800, max: 2400, def: 2200 },
    { id: 'coolDown', name: K('Shutdown cool-down delay'), unit: 's', min: 0, max: 120, def: 6 },
  ] },
  trans: { title: K('Transmission'), items: [
    { id: 'maxF', name: K('Maximum gear, forward'), unit: '', min: 1, max: 3, def: 3 },
    { id: 'maxR', name: K('Maximum gear, reverse'), unit: '', min: 1, max: 3, def: 2 },
    { id: 'lockup', name: K('Lock-up engage speed'), unit: 'km/h', min: 8, max: 25, def: 14 },
    { id: 'shiftDelay', name: K('Shift delay after new gear'), unit: 'ms', min: 100, max: 1500, def: 400 },
  ] },
  retarder: { title: K('Retarder'), items: [
    { id: 'retStrength', name: K('Retarder strength'), unit: '%', min: 0, max: 100, def: 60 },
    { id: 'retStart', name: K('Retarder start speed'), unit: 'km/h', min: 2, max: 15, def: 5 },
  ] },
  mixer: { title: K('Mixer drum'), items: [
    { id: 'drumLever', name: K('Lever command for drum rotation'), unit: '%', min: 20, max: 100, def: 70 },
    { id: 'halfStep', name: K('Rear half-throttle step'), unit: 'rpm', min: 50, max: 400, def: 150 },
  ] },
  system: { title: K('Machine identity'), items: [
    { id: 'serial', name: K('Machine serial number'), unit: '', min: 10000, max: 99999, def: 10000, level: 3 },
  ] },
};
const PV = {};
Object.values(PARAMS).forEach((g) => g.items.forEach((p) => { PV[p.id] = p.def; }));
PV.serial = 24117;
const P = (id) => PV[id];
const findParam = (id) => { for (const [gk, g] of Object.entries(PARAMS)) { const p = g.items.find((x) => x.id === id); if (p) return { p, gk, g }; } return null; };
const withUnit = (v, u) => (u === '%' ? pct(v) : u ? v + ' ' + tu(u) : String(v));

/* ================= state ================= */
const S = {
  screen: 'drive', theme: 'night', bright: 100, lang: 'en', tz: 0,
  access: 0, accessUntil: 0,
  m: null,
  regen: { inhibit: true, confirmed: false, running: false, done: false, from: 0, count: 142 },
  alerts: [], seq: 0, alertTab: 'active', alertSel: null,
  modal: null, modalQueue: [], toast: null,
  cam: null, boot: null,
  diag: 'engine', canSel: 0x10,
  bt: { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: false, saved: false },
  svc: { q: '', panel: 'home', param: null, mode: 'view', entry: '', calib: null, usb: null },
  phist: [], outputs: {}, reports: [],
};
const freshMachine = () => ({
  ign: true, engineOn: true, preheat: 0, crank: 0, delay: 0, neutralNeeded: 0, _starting: null, _stopping: false,
  dir: 'F', throttle: 0.35, parkBrake: false, pedal: false,
  speed: 12, rpm: 1500, gear: 2, odo: 4812.6, trip: 18.4, hours: 2931.2,
  coolant: 86, transT: 78, transP: 17, hyd: 64, hydTarget: 64, fuel: 62, oilP: 380, fuelP: 520, boostP: 1.1, boostT: 48, battery: 27.6,
  soot: 64, ash: 18, def: 48, exhaustT: 300,
  acc: { f: 172, r: 170, p: 165 }, svc: { f: 0, r: 0, p: 140 },
  fault: {},
  drumCmd: 1, drumAct: 1, drumLock: false, ctrlRear: false, mixUp: 0, mixDown: 0, halfUp: 0, halfDown: 0, rearAdd: 0,
  doorL: false, doorR: false, belt: true, steerLock: false, sigL: false, sigR: false, hazard: false,
  headlight: true, workF: true, workR: false, horn: 0, windowHeat: false, ac: true,
  dtc: [], dtcActive: false, dtcPassive: false,
  hydHist: [],
});
S.m = freshMachine();
(() => {
  let l = null;
  try { l = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
  if (!l) { try { l = localStorage.getItem('hmi-lang'); } catch (e) { /* ignore */ } }
  if (l === 'tr' || l === 'en') S.lang = l;
})();

/* ================= CAN layer (BYM6.dbc) ================= */
const DB = window.CAN_DB || { messages: [] };
const MSG = {}; const SIG = {};
DB.messages.forEach((mm) => { MSG[mm.id] = mm; mm.signals.forEach((s) => { SIG[s.name] = { s, m: mm }; }); });
const TIMEOUT = 1000; // assumed: the DBC has no cycle times
const BUS = { frames: {}, dropAll: false, mrsOff: false, sent: 0 };
const MRS_MSGS = [0x1500];
function writeBits(b, start, len, raw) {
  for (let i = 0; i < len; i++) { const bit = start + i; const on = Math.floor(raw / Math.pow(2, i)) % 2 === 1; if (on) b[bit >> 3] |= (1 << (bit & 7)); else b[bit >> 3] &= ~(1 << (bit & 7)); }
}
function readBits(b, start, len) { let v = 0; for (let i = 0; i < len; i++) { const bit = start + i; if (b[bit >> 3] & (1 << (bit & 7))) v += Math.pow(2, i); } return v; }
function sendFrame(id, phys) {
  const mm = MSG[id]; if (!mm) return;
  const b = new Uint8Array(mm.dlc || 8);
  mm.signals.forEach((s) => {
    let v = phys[s.name]; if (v == null) return;
    if (v === true) v = 1; if (v === false) v = 0;
    const raw = clamp(Math.round((v - s.offset) / s.factor), 0, Math.pow(2, s.len) - 1);
    writeBits(b, s.start, s.len, raw);
  });
  BUS.frames[id] = { data: b, t: now() }; BUS.sent++;
}
const fresh = (id) => { const f = BUS.frames[id]; return !!f && now() - f.t <= TIMEOUT; };
function RAW(name) { const e = SIG[name]; if (!e) return null; const f = BUS.frames[e.m.id]; if (!f || now() - f.t > TIMEOUT) return null; return readBits(f.data, e.s.start, e.s.len); }
function C(name) { const r = RAW(name); if (r == null) return null; const e = SIG[name]; return r * e.s.factor + e.s.offset; }
const B = (name) => { const v = C(name); return v == null ? null : v >= 0.5; };
const one = (n) => B(n) === true;
const ECU_CORE = [0x10, 0x20, 0x30, 0x40, 0x50];
const ecuOk = () => ECU_CORE.every(fresh);
const mrsOk = () => MRS_MSGS.every(fresh) && B('REAR_ECU_MRS_STATUS') === true;

/* unit and scaling assumptions the DBC leaves open */
const LEVER_SIGS = ['FRONT_MIXER_ROTATION_LEVER_RIGHT', 'FRONT_MIXER_ROTATION_LEVER_LEFT', 'REAR_MIXER_ROTATION_LEVER_RIGHT', 'REAR_MIXER_ROTATION_LEVER_LEFT'];
const ASSUME = {
  FUEL_LEVEL: { unit: '%', mul: 0.4, note: K('Assumed 0.4 % per bit (J1939). The DBC gives raw 0–255.') },
  GAS_PEDAL: { unit: '%', mul: 0.4, note: K('Assumed 0.4 % per bit (J1939). The DBC gives raw 0–255.') },
  ENGINE_OIL_PRESSURE: { unit: 'kPa', note: K('Unit assumed kPa (4 kPa per bit, as J1939).') },
  FUEL_PRESSURE: { unit: 'kPa', note: K('Unit assumed kPa (4 kPa per bit, as J1939).') },
  ENGINE_COOLANT_TEMPERATURE: { unit: '°C' }, BOOST_TEMPERATURE: { unit: '°C' },
  BOOST_PRESSURE: { unit: 'bar', note: K('Unit assumed bar (0.02 per bit).') },
  BATTERY_VOLTAGE: { unit: 'V', note: K('0.5 V per bit is coarse. J1939 uses 0.05 V. Check.') },
  HYDRAULIC_OIL_TEMPERATURE: { unit: '°C', note: K('No offset in the DBC, so it cannot show below 0 °C. Check.') },
  TRANSMISSION_OIL_TEMPERATURE: { unit: '°C', note: K('No offset in the DBC, so it cannot show below 0 °C. Check.') },
  VEHICLE_SPEED_KM_H: { unit: 'km/h' }, ENGINE_SPEED: { unit: 'rpm' },
  MIXER_RIGHT_COIL_CURRENT_MA_2: { unit: 'mA', note: K('Name says right. Probably the left coil. Check.') },
  SEAT_BELT: { note: K('Assumed 1 = belt not fastened (warning lamp).') },
  LEFT_DOOR_SENSOR: { note: K('Assumed 1 = door open.') }, RIGHT_DOOR_SENSOR: { note: K('Assumed 1 = door open.') },
  MIXER_TURNING_RIGHT: { note: K('Assumed right = mixing, left = discharging.') },
  MIXER_TURNING_LEFT: { note: K('Assumed right = mixing, left = discharging.') },
  MIXER_UP_FROM_MRS: { note: K('Meaning of mixer up and down not stated in the DBC.') },
  MIXER_DOWN_FROM_MRS: { note: K('Meaning of mixer up and down not stated in the DBC.') },
};
['FRONT_AXLE_ACCUMULATOR_PRESSURE', 'REAR_AXLE_ACCUMULATOR_PRESSURE', 'PARK_BRAKE_ACCUMULATOR_PRESSURE', 'FRONT_AXLE_SERVICE_PRESSURE', 'REAR_AXLE_SERVICE_PRESSURE', 'PARKING_BRAKE_SERVICE_PRESSURE', 'TRANSMISSION_OIL_PRESSURE'].forEach((n) => { ASSUME[n] = { unit: 'bar', note: K('Unit assumed bar.') }; });
LEVER_SIGS.forEach((n) => { ASSUME[n] = { unit: '%', mul: 0.1, note: K('Assumed raw 0–1000 = 0–100 %. Needs calibration limits.') }; });
['FORWARD_GEAR_CURRENT', 'REVERSE_GEAR_CURRENT', 'GEAR_1_CURRENT', 'GEAR_2_CURRENT', 'GEAR_3_CURRENT', 'LOCK_UP_GEAR_CURRENT'].forEach((n) => { ASSUME[n] = { unit: 'mA', note: K('Unit assumed mA.') }; });
const V = (name) => { const v = C(name); if (v == null) return null; const a = ASSUME[name]; return a && a.mul ? v * a.mul : v; };

/* engineering values for the UI, decoded from the bus */
const G = {
  speed: () => C('VEHICLE_SPEED_KM_H'),
  rpm: () => C('ENGINE_SPEED'),
  hours: () => C('ENGINE_WORKING_HOUR'),
  fuel: () => V('FUEL_LEVEL'),
  pedal: () => V('GAS_PEDAL'),
  coolant: () => C('ENGINE_COOLANT_TEMPERATURE'),
  oilBar: () => { const v = C('ENGINE_OIL_PRESSURE'); return v == null ? null : v / 100; },
  fuelP: () => C('FUEL_PRESSURE'),
  boost: () => C('BOOST_PRESSURE'),
  boostT: () => C('BOOST_TEMPERATURE'),
  battery: () => C('BATTERY_VOLTAGE'),
  transT: () => C('TRANSMISSION_OIL_TEMPERATURE'),
  transP: () => C('TRANSMISSION_OIL_PRESSURE'),
  hyd: () => C('HYDRAULIC_OIL_TEMPERATURE'),
};
function gearState() {
  if (!fresh(0x10)) return null;
  const dir = B('GEAR_FORWARD') ? 'F' : B('GEAR_REVERSE') ? 'R' : B('GEAR_NEUTRAL') ? 'N' : '–';
  let g = 0;
  if (dir === 'F') g = B('GEAR_FORWARD_1') ? 1 : B('GEAR_FORWARD_2') ? 2 : B('GEAR_FORWARD_3') ? 3 : 0;
  if (dir === 'R') g = B('GEAR_REVERSE_1') ? 1 : B('GEAR_REVERSE_2') ? 2 : B('GEAR_REVERSE_3') ? 3 : 0;
  return { dir, g };
}
const drumDir = () => (one('MIXER_TURNING_RIGHT') ? 1 : one('MIXER_TURNING_LEFT') ? -1 : 0);

/* brake circuits */
const BRAKES = [
  { k: 'f', l: K('Front axle'), acc: 'FRONT_AXLE_ACCUMULATOR_PRESSURE', svc: 'FRONT_AXLE_SERVICE_PRESSURE', accF: 'FRONT_AXLE_ACCUMULATOR_FAULT', accS: 'FRONT_AXLE_ACCUMULA_SENSOR_FAULT', svcS: 'FRONT_AXLE_SERVICE_SENSOR_FAULT' },
  { k: 'r', l: K('Rear axle'), acc: 'REAR_AXLE_ACCUMULATOR_PRESSURE', svc: 'REAR_AXLE_SERVICE_PRESSURE', accF: 'REAR_AXLE_ACCUMULATOR_FAULT', accS: 'REAR_AXLE_ACCUMULA_SENSOR_FAULT', svcS: 'REAR_AXLE_SERVICE_SENSOR_FAULT' },
  { k: 'p', l: K('Parking brake'), acc: 'PARK_BRAKE_ACCUMULATOR_PRESSURE', svc: 'PARKING_BRAKE_SERVICE_PRESSURE', accF: 'PARKING_BRAKE_ACCUMULATOR_FAULT', accS: 'PARK_BREAK_ACCUMULA_SENSOR_FAULT', svcS: 'PARK_BREAK_SERVICE_SENSOR_FAULT' },
];
const brakeState = (b) => { if (!fresh(0x20) || !fresh(0x50) || !fresh(0x1300)) return 'nodata'; if (one(b.accF)) return 'alarm'; if (one(b.accS) || one(b.svcS)) return 'sensor'; return 'ok'; };

/* transmission and drum coils: commanded vs measured */
function valveRows() {
  const gs = gearState(); const run = one('ENGINE_STATUS'); const lock = one('LOCK_UP_ACTIVE_SYMBOL');
  const inGear = (n) => !!(gs && gs.g === n && gs.dir !== 'N' && run);
  const rows = [
    { l: K('Forward clutch'), sig: 'FORWARD_GEAR_CURRENT', want: !!(gs && gs.dir === 'F' && run) },
    { l: K('Reverse clutch'), sig: 'REVERSE_GEAR_CURRENT', want: !!(gs && gs.dir === 'R' && run) },
    { l: K('Gear 1 clutch'), sig: 'GEAR_1_CURRENT', want: inGear(1) },
    { l: K('Gear 2 clutch'), sig: 'GEAR_2_CURRENT', want: inGear(2) },
    { l: K('Gear 3 clutch'), sig: 'GEAR_3_CURRENT', want: inGear(3) },
    { l: K('Lock-up clutch'), sig: 'LOCK_UP_GEAR_CURRENT', want: lock },
    { l: K('Drum coil, right'), sig: 'MIXER_RIGHT_COIL_CURRENT_MA', want: one('MIXER_TURNING_RIGHT') },
    { l: K('Drum coil, left (_2)'), sig: 'MIXER_RIGHT_COIL_CURRENT_MA_2', want: one('MIXER_TURNING_LEFT') },
  ];
  rows.forEach((r) => { const v = C(r.sig); r.ma = v; if (v == null) r.st = 'nodata'; else { const on = v > 200; r.st = r.want === on ? 'ok' : r.want ? 'open' : 'unexpected'; } });
  return rows;
}

/* J1939 diagnostic trouble codes (SPN + FMI). Names are J1939 standard. Confirm with the engine maker. */
const SPN = {
  91: K('Accelerator pedal position'), 94: K('Fuel delivery pressure'), 97: K('Water in fuel'), 100: K('Engine oil pressure'),
  102: K('Boost pressure'), 105: K('Intake manifold temperature'), 110: K('Engine coolant temperature'), 168: K('Battery voltage'),
  190: K('Engine speed'), 636: K('Camshaft position sensor'), 637: K('Crankshaft position sensor'), 651: K('Injector, cylinder 1'),
  3251: K('DPF differential pressure'), 3719: K('DPF soot load'),
};
const FMI = {
  0: K('Above normal range, most severe'), 1: K('Below normal range, most severe'), 2: K('Erratic or intermittent data'),
  3: K('Voltage high or shorted to high'), 4: K('Voltage low or shorted to low'), 5: K('Current low or open circuit'),
  6: K('Current high or grounded circuit'), 7: K('Mechanical system not responding'), 8: K('Abnormal frequency or pulse width'),
  9: K('Abnormal update rate'), 10: K('Abnormal rate of change'), 11: K('Root cause not known'), 12: K('Bad device or component'),
  13: K('Out of calibration'), 14: K('Special instructions'), 15: K('Above normal range, least severe'), 16: K('Above normal range, moderately severe'),
  17: K('Below normal range, least severe'), 18: K('Below normal range, moderately severe'), 19: K('Received network data in error'),
  20: K('Data drifted high'), 21: K('Data drifted low'), 31: K('Condition exists'),
};
function dtcList() {
  const out = [];
  for (let i = 1; i <= 5; i++) { const spn = C('SPN_' + i + '_FAULT_CODE'); const fmi = C('FMI_' + i + '_FAULT_CODE'); if (spn) out.push({ i, spn, fmi }); }
  return out;
}
const spnName = (n) => (SPN[n] ? tx(SPN[n]) : tx('Unknown SPN'));
const fmiName = (n) => (n == null ? NA : FMI[n] ? tx(FMI[n]) : tx('Unknown FMI'));

/* ================= indicators (from CAN bits) ================= */
const bit = (n, st) => () => (one(n) ? st : null);
const moving = (min) => (G.speed() || 0) > min;
const INDS = [
  { k: 'canlost', l: K('No data from ECU'), s: () => (!ecuOk() ? 'alarm' : null), go: 'engine', diag: 'can' },
  { k: 'mrs', l: K('Rear station offline'), s: () => (ecuOk() && !mrsOk() ? 'warn' : null), go: 'mixer' },
  { k: 'alarms', l: K('Active alarms'), s: () => (S.alerts.some((a) => a.active && a.sev === 'alarm') ? 'alarm' : null), go: 'alerts' },
  { k: 'oilp', p: 'oil-pressure', l: K('Engine oil pressure'), s: bit('ENGINE_OIL_PRESSURE_WARNING', 'alarm'), go: 'alerts' },
  { k: 'cool', p: 'coolant', l: K('Engine coolant fault'), s: bit('ENGINE_COOLANT_FAULT', 'alarm'), go: 'alerts' },
  { k: 'hydT', l: K('Hydraulic oil hot'), s: bit('HYDRAULIC_OIL_TEMP_HIGH', 'alarm'), go: 'alerts' },
  { k: 'hydL', p: 'oil-level', l: K('Hydraulic oil level low'), s: bit('HYDRAULIC_LEVEL_LOW', 'alarm'), go: 'alerts' },
  { k: 'transP', p: 'trans-pressure', l: K('Transmission oil pressure low'), s: bit('TRANSMISSION_OIL_PRESSURE_LOW', 'alarm'), go: 'alerts' },
  { k: 'coil', l: K('Transmission coil short circuit'), s: bit('TRANS_COIL_SHORT_CIRCUIT_WARNING', 'alarm'), go: 'engine', diag: 'valves' },
  { k: 'acc', p: 'brake', l: K('Brake accumulator fault'), s: bit('GENERAL_ACCUMULA_FAULT_WARNING', 'alarm'), go: 'drive' },
  { k: 'steer', p: 'steer-lock', l: K('Steering wheel locked'), s: () => (one('STEERING_WHEEL_LOCKED') ? (moving(0) ? 'alarm' : 'info') : null), go: 'alerts' },
  { k: 'eng', p: 'engine', l: K('Engine warning'), s: bit('ENGINE_WARNING', 'warn'), go: 'engine', diag: 'engine' },
  { k: 'dtc', p: 'engine', l: K('Engine fault code'), s: () => (one('ACTIVE_FAULT') ? 'warn' : one('PASSIVE_FAULT') ? 'info' : null), go: 'engine', diag: 'engine' },
  { k: 'neutral', l: K('Shift to neutral'), s: bit('GEAR_NEUTRAL_NEEDED_WARNING', 'warn'), go: 'drive' },
  { k: 'oillvl', p: 'oil-level', l: K('Engine oil level low'), s: bit('ENGINE_OIL_LEVEL_LOW', 'warn'), go: 'alerts' },
  { k: 'water', p: 'water-fuel', l: K('Water in fuel'), s: bit('WATER_IN_FUEL', 'warn'), go: 'alerts' },
  { k: 'air', p: 'air-filter', l: K('Air filter blocked'), s: bit('AIR_FILTER_FAULT', 'warn'), go: 'alerts' },
  { k: 'fuel', p: 'fuel', l: K('Fuel low'), s: bit('FUEL_LOW', 'warn'), go: 'drive' },
  { k: 'batt', p: 'battery', l: K('Battery not charging'), s: () => (one('BATTERY_NOT_CHARGING_WARNING_1') || one('BATTERY_NOT_CHARGING_WARNING_2') ? 'warn' : null), go: 'alerts' },
  { k: 'transT', p: 'trans-temp', l: K('Transmission temperature fault'), s: bit('TRANSMISSION_TEMP_FAULT', 'warn'), go: 'alerts' },
  { k: 'transF', l: K('Transmission filter'), s: bit('TRANSMISSION_FILTER_WARNING', 'warn'), go: 'alerts' },
  { k: 'drumlockw', p: 'lock', l: K('Drum locked'), s: () => (one('MIXER_LOCKED_WARNING_SYMBOL') ? 'warn' : one('MIXER_LOCKED_SYMBOL') ? 'info' : null), go: 'mixer' },
  { k: 'door', p: 'door', l: K('Cab door open'), s: () => (one('LEFT_DOOR_SENSOR') || one('RIGHT_DOOR_SENSOR') ? (moving(2) ? 'warn' : 'info') : null), go: 'alerts' },
  { k: 'belt', p: 'seat-belt', l: K('Seat belt not fastened'), s: () => (one('SEAT_BELT') ? (moving(2) ? 'warn' : 'info') : null), go: 'alerts' },
  { k: 'acgas', p: 'ac', l: K('Air conditioning gas low'), s: bit('AIR_CONDITIONER_GAS_LOW', 'info'), go: 'alerts' },
  { k: 'dpf', l: K('Regenerate DPF when parked'), s: () => (S.m.soot >= 80 ? 'alarm' : S.m.soot > 60 ? 'warn' : null), go: 'exhaust' },
  { k: 'preheat', p: 'preheat', l: K('Preheating'), s: bit('PREHEAT_LAMP', 'info'), go: 'drive' },
  { k: 'crank', p: 'key', l: K('Cranking'), s: bit('ENGINE_CRANKKING', 'info'), go: 'drive' },
  { k: 'delay', p: 'engine-shutoff', l: K('Engine cool-down'), s: bit('ENGINE_DELAY_ACTIVE', 'info'), go: 'drive' },
  { k: 'park', p: 'park-brake', l: K('Parking brake on'), s: bit('PARKING_BRAKE_ACTIVE', 'info'), go: 'drive' },
  { k: 'ret', p: 'retarder', l: K('Retarder active'), s: bit('RETARDER_ACTIVE', 'info'), go: 'drive' },
  { k: 'lockup', p: 'lockup', l: K('Lock-up active'), s: bit('LOCK_UP_ACTIVE_SYMBOL', 'info'), go: 'drive' },
  { k: 'drumR', l: K('Drum turning right'), s: bit('MIXER_TURNING_RIGHT', 'info'), go: 'mixer' },
  { k: 'drumL', l: K('Drum turning left'), s: bit('MIXER_TURNING_LEFT', 'info'), go: 'mixer' },
  { k: 'rear', l: K('Drum control at rear'), s: bit('MIXER_CONTROL_AT_REAR_SIDE', 'info'), go: 'mixer' },
  { k: 'hazard', p: 'hazard', l: K('Hazard lights'), s: bit('FLASHER', 'info'), go: 'drive' },
  { k: 'head', p: 'headlight', l: K('Headlights'), s: bit('HEADLIGHT', 'info'), go: 'drive' },
  { k: 'workF', p: 'work-front', l: K('Front work lamps'), s: bit('FRONT_WORKING_LAMP', 'info'), go: 'drive' },
  { k: 'workR', p: 'work-rear', l: K('Rear work lamps'), s: bit('REAR_WORKING_LAMP', 'info'), go: 'drive' },
  { k: 'rev', l: K('Reverse lamp'), s: bit('REVERSE_GEAR_LAMP', 'info'), go: 'drive' },
  { k: 'win', p: 'window-heat', l: K('Heated window'), s: bit('WINDOW_RESISTANCE', 'info'), go: 'drive' },
  { k: 'ac', p: 'ac', l: K('Air conditioning on'), s: bit('AC_SYSTEM_ACTIVE', 'info'), go: 'drive' },
  { k: 'horn', l: K('Horn'), s: bit('HORN', 'info'), go: 'drive' },
];
const SEVRANK = { alarm: 0, warn: 1, info: 2 };
const NOISY = new Set(['head', 'workF', 'workR', 'win', 'ac', 'horn', 'rev']);
const activeInds = () => INDS.map((i) => ({ ...i, st: i.s() })).filter((i) => i.st && !(i.st === 'info' && NOISY.has(i.k))).sort((a, b) => SEVRANK[a.st] - SEVRANK[b.st]);
const SEVNAME = { alarm: K('Alarm'), warn: K('Warning'), info: K('Info') };

/* ================= alerts (from CAN) ================= */
const AD = [
  { key: 'canlost', code: 'CAN', sev: 'alarm', src: K('CAN bus'), c: () => !ecuOk(),
    title: K('No data from the machine ECU'), sub: K('Values on screen are not live'),
    what: K('The display has not received the main ECU messages for more than 1 second.'), effect: K('All gauges show ––. Warnings from the ECU cannot reach the display.'),
    steps: [K('Stop the machine safely.'), K('Check the CAN connector behind the display and at the ECU.'), K('Open Diagnostics › CAN bus to see which messages are missing.')], link: ['engine', K('Open CAN bus'), 'can'] },
  { key: 'mrs', code: '0x1500', sev: 'warn', src: K('Rear station (MRS)'), c: () => ecuOk() && !mrsOk(),
    title: K('Rear control station offline'), sub: K('Rear ECU status lost'),
    what: K('The rear ECU (MRS) stopped reporting or reports a fault.'), effect: K('Drum controls and half-throttle at the rear do not work.'),
    steps: [K('Use the drum controls in the cab.'), K('Check the rear station cable and fuse.')], link: ['mixer', K('Open Mixer')] },
  { key: 'oilp', p: 'oil-pressure', code: 'OILP', sev: 'alarm', src: K('Engine'), c: () => one('ENGINE_OIL_PRESSURE_WARNING'),
    title: K('Engine oil pressure low'), sub: () => tx('{0} bar', f1(G.oilBar())),
    what: () => tx('Engine oil pressure is {0} bar with the engine running.', f1(G.oilBar())), effect: K('Running on can damage the engine within minutes.'),
    steps: [K('Stop the engine as soon as it is safe.'), K('Check the engine oil level.'), K('Do not restart until maintenance has checked it.')], link: ['engine', K('Open Diagnostics'), 'engine'] },
  { key: 'cool', p: 'coolant', code: 'COOL', sev: 'alarm', src: K('Engine'), c: () => one('ENGINE_COOLANT_FAULT'),
    title: K('Engine coolant fault'), sub: () => tx('Coolant {0} °C', f0(G.coolant())),
    what: () => tx('The engine reports a coolant fault. Coolant is at {0} °C.', f0(G.coolant())), effect: K('The engine may derate or shut down.'),
    steps: [K('Let the engine idle to cool, then stop it.'), K('Check the coolant level when cold.')], link: ['drive', K('See gauge on Drive')] },
  { key: 'hydT', code: 'HYD-T', sev: 'alarm', src: K('Hydraulics'), c: () => one('HYDRAULIC_OIL_TEMP_HIGH'),
    title: K('Hydraulic oil temperature high'), sub: () => tx('{0} °C', f0(G.hyd())),
    what: () => tx('Hydraulic oil is at {0} °C.', f0(G.hyd())), effect: K('Seals and pumps wear faster. Drum speed may be limited.'),
    steps: [K('Stop drum work if possible.'), K('Check the oil cooler for dust or blockage.'), K('If it stays high, call maintenance.')], trend: true, link: ['drive', K('See gauge on Drive')] },
  { key: 'hydL', p: 'oil-level', code: 'HYD-L', sev: 'alarm', src: K('Hydraulics'), c: () => one('HYDRAULIC_LEVEL_LOW'),
    title: K('Hydraulic oil level low'), sub: K('Check for leaks'),
    what: K('The hydraulic tank level switch reports low oil.'), effect: K('Pumps can draw air and get damaged.'),
    steps: [K('Stop and look for leaks.'), K('Top up hydraulic oil before continuing.')] },
  { key: 'transP', p: 'trans-pressure', code: 'TR-P', sev: 'alarm', src: K('Transmission'), c: () => one('TRANSMISSION_OIL_PRESSURE_LOW'),
    title: K('Transmission oil pressure low'), sub: () => tx('{0} bar', f0(G.transP())),
    what: () => tx('Transmission oil pressure is {0} bar.', f0(G.transP())), effect: K('Clutches can slip and burn.'),
    steps: [K('Stop driving.'), K('Check the transmission oil level.'), K('Call maintenance.')] },
  { key: 'coil', p: 'trans-pressure', code: 'TR-COIL', sev: 'alarm', src: K('Transmission'), c: () => one('TRANS_COIL_SHORT_CIRCUIT_WARNING'),
    title: K('Transmission coil short circuit'), sub: K('A gear solenoid is shorted'),
    what: K('The ECU detected a short circuit on a transmission solenoid.'), effect: K('The affected gear may not engage.'),
    steps: [K('Stop the machine.'), K('Open Diagnostics › Valves to see which coil.')], link: ['engine', K('Open Valves'), 'valves'] },
  { key: 'valve', code: 'VALVE', sev: 'warn', src: K('Transmission'), c: () => valveRows().some((r) => r.st === 'open' || r.st === 'unexpected'),
    title: K('Valve current does not match command'), sub: () => valveRows().filter((r) => r.st === 'open' || r.st === 'unexpected').map((r) => tx(r.l)).join(', '),
    what: K('A clutch or drum coil is commanded but draws no current, or draws current when it should be off.'), effect: K('The gear or drum function may not work as expected.'),
    steps: [K('Open Diagnostics › Valves.'), K('Check the coil connector and wiring.')], link: ['engine', K('Open Valves'), 'valves'] },
  { key: 'acc', p: 'brake', code: 'BRK-ACC', sev: 'alarm', src: K('Brakes'), c: () => BRAKES.some((b) => one(b.accF)) || one('GENERAL_ACCUMULA_FAULT_WARNING'),
    title: K('Brake accumulator fault'), sub: () => BRAKES.filter((b) => one(b.accF)).map((b) => tx(b.l)).join(', ') || tx('General'),
    what: K('A brake accumulator cannot hold enough pressure.'), effect: K('Braking distance may be longer.'),
    steps: [K('Stop the machine in a safe place.'), K('Apply the parking brake.'), K('Do not drive until maintenance has checked it.')], link: ['drive', K('See brakes on Drive')] },
  { key: 'bsens', p: 'brake', code: 'BRK-SNS', sev: 'warn', src: K('Brakes'), c: () => BRAKES.some((b) => one(b.accS) || one(b.svcS)),
    title: K('Brake pressure sensor fault'), sub: () => BRAKES.filter((b) => one(b.accS) || one(b.svcS)).map((b) => tx(b.l)).join(', '),
    what: K('A brake pressure sensor reports a fault. Its reading cannot be trusted.'), effect: K('The display shows Sensor fault for that value, not a number.'),
    steps: [K('Brake carefully and check the brakes work.'), K('Report it to maintenance this shift.')], link: ['drive', K('See brakes on Drive')] },
  { key: 'tsens', p: 'trans-pressure', code: 'TR-SNS', sev: 'warn', src: K('Transmission'), c: () => one('TRANSMISSION_PRESS_SENSOR_FAULT'),
    title: K('Transmission pressure sensor fault'), sub: K('Pressure reading not reliable'),
    what: K('The transmission pressure sensor reports a fault.'), effect: K('Low-pressure protection may not work.'),
    steps: [K('Report it to maintenance this shift.')] },
  { key: 'steer', p: 'steer-lock', code: 'STEER', sev: 'alarm', src: K('Cab'), c: () => one('STEERING_WHEEL_LOCKED') && moving(0),
    title: K('Steering wheel locked while moving'), sub: () => tx('{0} km/h', f0(G.speed())),
    what: K('The steering lock is on while the machine moves.'), effect: K('The machine cannot be steered.'),
    steps: [K('Brake and stop now.'), K('Release the steering lock before driving.')] },
  { key: 'door', p: 'door', code: 'DOOR', sev: 'warn', src: K('Cab'), c: () => (one('LEFT_DOOR_SENSOR') || one('RIGHT_DOOR_SENSOR')) && moving(2),
    title: K('Cab door open while moving'), sub: () => [one('LEFT_DOOR_SENSOR') ? tx('Left') : '', one('RIGHT_DOOR_SENSOR') ? tx('Right') : ''].filter(Boolean).join(' + '),
    what: K('A cab door is open while the machine moves.'), effect: K('Risk of falling out or being hit.'),
    steps: [K('Stop and close the door.')] },
  { key: 'belt', p: 'seat-belt', code: 'BELT', sev: 'warn', src: K('Cab'), c: () => one('SEAT_BELT') && moving(2),
    title: K('Seat belt not fastened'), sub: K('While moving'),
    what: K('The seat belt is not fastened while the machine moves.'), effect: K('No protection in a rollover or collision.'),
    steps: [K('Stop and fasten the seat belt.')] },
  { key: 'neutral', code: 'GEAR-N', sev: 'warn', src: K('Transmission'), c: () => one('GEAR_NEUTRAL_NEEDED_WARNING'),
    title: K('Shift to neutral'), sub: K('Needed to start the engine'),
    what: K('The engine will only start with the drive lever in neutral.'), effect: K('The starter is blocked.'),
    steps: [K('Move the drive lever to N.'), K('Start the engine again.')] },
  { key: 'eng', p: 'engine', code: 'ENG', sev: 'warn', src: K('Engine'), c: () => one('ENGINE_WARNING') && !one('ENGINE_OIL_PRESSURE_WARNING') && !one('ENGINE_COOLANT_FAULT'),
    title: K('Engine warning lamp on'), sub: K('See engine fault codes'),
    what: K('The engine controller has a warning.'), effect: K('Depends on the fault. Check the fault codes.'),
    steps: [K('Open Diagnostics › Engine for the fault codes.')], link: ['engine', K('Open Diagnostics'), 'engine'] },
  { key: 'oillvl', p: 'oil-level', code: 'OIL-L', sev: 'warn', src: K('Engine'), c: () => one('ENGINE_OIL_LEVEL_LOW'),
    title: K('Engine oil level low'), sub: K('Top up at the next stop'), what: K('The engine oil level switch reports low oil.'), effect: K('None yet.'), steps: [K('Top up engine oil at the next stop.')] },
  { key: 'water', p: 'water-fuel', code: 'WIF', sev: 'warn', src: K('Fuel system'), c: () => one('WATER_IN_FUEL'),
    title: K('Water in fuel'), sub: K('Drain the water separator'), what: K('The fuel filter sensor detected water.'), effect: K('Injectors can be damaged if it continues.'), steps: [K('Drain the water separator at the next stop.')] },
  { key: 'air', p: 'air-filter', code: 'AIR', sev: 'warn', src: K('Engine'), c: () => one('AIR_FILTER_FAULT'),
    title: K('Air filter blocked'), sub: K('Replace at the next service'), what: K('The air filter restriction switch is on.'), effect: K('Less engine power and more smoke.'), steps: [K('Clean or replace the air filter.')] },
  { key: 'fuel', p: 'fuel', code: 'FUEL', sev: 'warn', src: K('Fuel system'), c: () => one('FUEL_LOW'),
    title: K('Fuel low'), sub: () => tx('{0} left', pct(f0(G.fuel()))), what: K('The fuel tank is nearly empty.'), effect: K('None yet.'), steps: [K('Refuel at the next opportunity.')], link: ['drive', K('See gauge on Drive')] },
  { key: 'batt', p: 'battery', code: 'BATT', sev: 'warn', src: K('Electrical'), c: () => one('BATTERY_NOT_CHARGING_WARNING_1') || one('BATTERY_NOT_CHARGING_WARNING_2'),
    title: K('Battery not charging'), sub: () => tx('{0} V', f1(G.battery())), what: K('The alternator is not charging the batteries.'), effect: K('The machine will stop when the batteries run flat.'), steps: [K('Check the alternator belt.'), K('Report it to maintenance.')] },
  { key: 'transT', p: 'trans-temp', code: 'TR-T', sev: 'warn', src: K('Transmission'), c: () => one('TRANSMISSION_TEMP_FAULT'),
    title: K('Transmission temperature fault'), sub: () => tx('{0} °C', f0(G.transT())), what: K('Transmission oil is too hot or its sensor is faulty.'), effect: K('Clutch wear increases.'), steps: [K('Drive in a lower gear and let it cool.')] },
  { key: 'transF', code: 'TR-F', sev: 'warn', src: K('Transmission'), c: () => one('TRANSMISSION_FILTER_WARNING'),
    title: K('Transmission filter clogged'), sub: K('Replace at the next service'), what: K('The transmission filter restriction switch is on.'), effect: K('None yet.'), steps: [K('Replace the transmission filter at the next service.')] },
  { key: 'drumlock', p: 'lock', code: 'DRUM-L', sev: 'warn', src: K('Mixer drum'), c: () => one('MIXER_LOCKED_WARNING_SYMBOL'),
    title: K('Drum is locked'), sub: K('Rotation requested while locked'), what: K('Drum rotation was requested but the drum lock is on.'), effect: K('The drum will not turn.'), steps: [K('Release the drum lock at the rear station.')], link: ['mixer', K('Open Mixer')] },
  { key: 'acgas', p: 'ac', code: 'AC', sev: 'info', src: K('Cab'), c: () => one('AIR_CONDITIONER_GAS_LOW'),
    title: K('Air conditioning gas low'), sub: K('Service the air conditioning'), what: K('The AC pressure switch reports low refrigerant.'), effect: K('Cab cooling is reduced.'), steps: [K('Have the air conditioning serviced.')] },
  { key: 'dpf6', code: 'DPF-L6', sev: 'alarm', src: K('Engine aftertreatment'), c: () => S.m.soot >= 80,
    title: K('Exhaust filter overloaded'), sub: () => tx('Soot {0} · level {1}', pct(f0(S.m.soot)), 6),
    what: K('The particulate filter is too full for a standstill regeneration.'), effect: K('Engine torque and speed are derated.'),
    steps: [K('Park the machine safely.'), K('Call the workshop. A service tool is needed.')], link: ['exhaust', K('Open Exhaust')] },
  { key: 'dpf5', code: 'DPF-L5', sev: 'warn', src: K('Engine aftertreatment'), c: () => S.m.soot >= 70 && S.m.soot < 80,
    title: K('Regenerate exhaust filter now'), sub: () => tx('Soot {0} · level {1}', pct(f0(S.m.soot)), 5),
    what: () => tx('Soot load in the particulate filter is {0}.', pct(f0(S.m.soot))), effect: K('At 80 % soot the engine is derated and a service tool is needed.'),
    steps: [K('Stop work and park safely.'), K('Run a standstill regeneration from the Exhaust screen.')], link: ['exhaust', K('Open Exhaust')] },
  { key: 'dpf4', code: 'DPF-L4', sev: 'warn', src: K('Engine aftertreatment'), c: () => S.m.soot > 60 && S.m.soot < 70,
    title: K('Exhaust filter needs regeneration'), sub: () => tx('Soot {0} · level {1}', pct(f0(S.m.soot)), 4),
    what: () => tx('Soot load in the particulate filter is {0}.', pct(f0(S.m.soot))), effect: K('None yet. At 80 % soot the engine is derated.'),
    steps: [K('Finish the current task and park safely.'), K('Open Exhaust and follow the standstill regeneration checks.')], link: ['exhaust', K('Open Exhaust')] },
];
function dtcAlertDefs() {
  if (!fresh(0x2800)) return [];
  const act = one('ACTIVE_FAULT');
  return dtcList().map((d) => ({
    key: 'dtc-' + d.spn + '-' + d.fmi, p: 'engine', code: 'SPN ' + d.spn + ' / FMI ' + (d.fmi == null ? '?' : d.fmi), sev: act ? 'warn' : 'info', src: K('Engine fault code'),
    title: () => spnName(d.spn), sub: () => fmiName(d.fmi),
    what: () => tx('Engine controller reports SPN {0}, FMI {1}: {2}.', d.spn, d.fmi == null ? '?' : d.fmi, fmiName(d.fmi)),
    effect: () => tx(act ? 'Active fault lamp is on.' : 'Stored fault. The passive fault lamp is on.'),
    steps: [K('Note the code and report it to maintenance.'), K('Fault names follow the J1939 standard. Confirm with the engine maker.')],
    link: ['engine', K('Open Diagnostics'), 'engine'], c: () => true,
  }));
}
function seedHistory() {
  const h = [
    { code: 'WIF', p: 'water-fuel', sev: 'warn', src: K('Fuel system'), title: K('Water in fuel'), what: K('The fuel filter sensor detected water.'), effect: K('None now that it has cleared.'), steps: [K('Drain the water separator at the next stop.')], ago: 170, len: 6 },
    { code: 'TR-F', sev: 'warn', src: K('Transmission'), title: K('Transmission filter clogged'), what: K('The transmission filter restriction switch is on.'), effect: K('None now that it has cleared.'), steps: [K('Replace the transmission filter at the next service.')], ago: 260, len: 22 },
    { code: 'BATT', p: 'battery', sev: 'warn', src: K('Electrical'), title: K('Battery not charging'), what: K('The alternator is not charging the batteries.'), effect: K('None now that it has cleared.'), steps: [K('Check the alternator belt.')], ago: 330, len: 2 },
  ];
  h.forEach((d) => { const t0 = now() - d.ago * 60e3; S.alerts.push({ id: ++S.seq, key: 'seed' + d.code, def: { ...d, sub: d.title }, sev: d.sev, active: false, acked: true, t0, t1: t0 + d.len * 60e3 }); });
}
function evalAlerts() {
  const defs = AD.concat(dtcAlertDefs());
  const liveKeys = new Set();
  defs.forEach((d) => {
    let on = false; try { on = !!d.c(); } catch (e) { on = false; }
    if (!on) return;
    liveKeys.add(d.key);
    const ex = S.alerts.find((a) => a.key === d.key && a.active);
    if (!ex) {
      const a = { id: ++S.seq, key: d.key, def: d, sev: d.sev, active: true, acked: d.sev === 'info', t0: now(), t1: 0 };
      S.alerts.push(a);
      if (d.sev === 'alarm' && !S.boot) openModal({ type: 'alarm', id: a.id });
    } else ex.def = d;
  });
  S.alerts.forEach((a) => {
    if (a.active && !liveKeys.has(a.key)) {
      a.active = false; a.t1 = now();
      if (S.modal && S.modal.type === 'alarm' && S.modal.id === a.id) closeModal();
      S.modalQueue = S.modalQueue.filter((q) => !(q.type === 'alarm' && q.id === a.id));
    }
  });
}
const activeAlerts = () => S.alerts.filter((a) => a.active).sort((a, b) => SEVRANK[a.sev] - SEVRANK[b.sev] || b.t0 - a.t0);
const historyAlerts = () => S.alerts.filter((a) => !a.active).sort((a, b) => b.t1 - a.t1);
const byId = (id) => S.alerts.find((a) => a.id === +id);

/* ================= derived checks ================= */
const dpfBand = () => { const s = S.m.soot; return s >= 100 ? 'max' : s >= 80 ? 'L6' : s >= 70 ? 'L5' : s > 60 ? 'L4' : 'L3'; };
const parkWord = (on) => (on == null ? NA : tx(on ? 'Applied|park' : 'Released|park'));
function regenChecks() {
  const gs = gearState(); const run = one('ENGINE_STATUS'); const spd = G.speed(); const park = B('PARKING_BRAKE_ACTIVE'); const cool = G.coolant();
  return [
    { l: tx('Engine running'), v: run ? f0(G.rpm()) + ' ' + tu('rpm') : tx('Off|engine'), ok: run },
    { l: tx('Machine stationary'), v: f0(spd) + ' ' + tu('km/h'), ok: spd === 0 },
    { l: tx('Parking brake applied'), v: parkWord(park), ok: park === true },
    { l: tx('Transmission in neutral'), v: gs ? gs.dir : NA, ok: !!gs && gs.dir === 'N' },
    { l: tx('Engine warm'), v: tx('Coolant {0} °C', f0(cool)), ok: cool != null && cool >= 60 },
  ];
}
function btChecks() {
  const gs = gearState(); const run = one('ENGINE_STATUS'); const park = B('PARKING_BRAKE_ACTIVE');
  const fS = C('FRONT_AXLE_SERVICE_PRESSURE'); const rS = C('REAR_AXLE_SERVICE_PRESSURE');
  const sens = one('FRONT_AXLE_SERVICE_SENSOR_FAULT') || one('REAR_AXLE_SERVICE_SENSOR_FAULT');
  return [
    { l: tx('Engine running'), ok: run, v: run ? tx('Running') : tx('Off|engine') },
    { l: tx('Drive direction forward'), ok: !!gs && gs.dir === 'F', v: gs ? gs.dir : NA },
    { l: tx('Parking brake released'), ok: park === false, v: parkWord(park) },
    { l: tx('Service brake applied, front and rear'), ok: !sens && fS != null && rS != null && fS > 50 && rS > 50, v: sens ? tx('Sensor fault') : f0(fS) + ' / ' + f0(rS) + ' bar', hint: sens ? tx('A service pressure sensor is faulty. The test cannot run.') : tx('Use Brake pedal in the reviewer panel') },
  ];
}
function dischargeChecks() {
  const gs = gearState();
  return [
    { l: tx('Parking brake applied'), ok: one('PARKING_BRAKE_ACTIVE') },
    { l: tx('Transmission in neutral'), ok: !!gs && gs.dir === 'N' },
    { l: tx('Drum not locked'), ok: B('MIXER_LOCKED_SYMBOL') === false },
    { l: tx('Drum control at rear station'), ok: one('MIXER_CONTROL_AT_REAR_SIDE') },
    { l: tx('Rear station online'), ok: mrsOk() },
    { l: tx('Hydraulic oil temperature OK'), ok: B('HYDRAULIC_OIL_TEMP_HIGH') === false },
  ];
}
const startHint = () => {
  if (!fresh(0x10)) return null;
  if (one('GEAR_NEUTRAL_NEEDED_WARNING')) return ['warn', tx('Shift to neutral to start')];
  if (fresh(0x1300) && one('ENGINE_CRANKKING')) return ['info', tx('Cranking…'), 'key'];
  if (one('PREHEAT_LAMP')) return ['info', tx('Preheating · wait'), 'preheat'];
  if (fresh(0x1300) && one('ENGINE_DELAY_ACTIVE')) return ['info', tx('Cool-down before shutdown'), 'engine-shutoff'];
  return null;
};

/* ================= scenarios ================= */
function base() {
  S.m = freshMachine();
  BUS.dropAll = false; BUS.mrsOff = false;
  Object.assign(S.regen, { inhibit: true, confirmed: false, running: false, done: false });
  S.bt = { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: false, saved: false };
  S.modal = null; S.modalQueue = []; S.cam = null;
  S.screen = 'drive';
}
function parked() { Object.assign(S.m, { dir: 'N', throttle: 0, parkBrake: true, speed: 0, gear: 0, svc: { f: 0, r: 0, p: 0 } }); }
const SCEN = [
  { k: 'normal', t: K('Normal shift'), d: K('Driving in F2, all OK'), f() { base(); S.m.soot = 32; } },
  { k: 'cold', t: K('Cold start'), d: K('Ignition on, lever in F'), f() { base(); Object.assign(S.m, { engineOn: false, rpm: 0, speed: 0, dir: 'F', throttle: 0, parkBrake: true, coolant: 6, hyd: 4, hydTarget: 4, transT: 5, battery: 24.4, oilP: 0, transP: 0, fuelP: 0, boostP: 0, drumCmd: 0, drumAct: 0, soot: 32 }); } },
  { k: 'discharge', t: K('Discharging at rear'), d: K('Parked, rear station, drum left'), f() { base(); parked(); Object.assign(S.m, { ctrlRear: true, drumCmd: -1, workR: true, soot: 40 }); S.screen = 'mixer'; } },
  { k: 'hyd', t: K('Hydraulic overheat'), d: K('Drum mixing, oil rising'), f() { base(); parked(); Object.assign(S.m, { hyd: 84, hydTarget: 97, drumCmd: 1, soot: 40 }); } },
  { k: 'acc', t: K('Brake accumulator fault'), d: K('Front circuit losing pressure'), f() { base(); S.m.soot = 40; S.m.fault.accLeakF = true; } },
  { k: 'sensor', t: K('Brake sensor fault'), d: K('Rear service sensor failed'), f() { base(); S.m.soot = 40; S.m.fault.svcSensR = true; } },
  { k: 'coil', t: K('Gear coil open circuit'), d: K('Gear 2 draws no current'), f() { base(); S.m.soot = 40; S.m.fault.gear2Open = true; S.screen = 'engine'; S.diag = 'valves'; } },
  { k: 'dtc', t: K('Engine fault codes'), d: K('SPN 100 and SPN 637'), f() { base(); S.m.soot = 40; S.m.dtc = [{ spn: 100, fmi: 18 }, { spn: 637, fmi: 2 }]; S.m.dtcActive = true; S.m.dtcPassive = true; S.m.fault.oilLow = true; S.screen = 'engine'; S.diag = 'engine'; } },
  { k: 'mrs', t: K('Rear station offline'), d: K('Rear ECU stops reporting'), f() { base(); parked(); Object.assign(S.m, { ctrlRear: true, drumCmd: 0, soot: 40 }); BUS.mrsOff = true; S.screen = 'mixer'; } },
  { k: 'canlost', t: K('CAN cable unplugged'), d: K('No frames from the ECU'), f() { base(); S.m.soot = 40; BUS.dropAll = true; } },
  { k: 'regen', t: K('Ready to regenerate'), d: () => tx('Parked, soot {0}', pct(66)), f() { base(); parked(); S.m.soot = 66; S.m.drumCmd = 0; S.screen = 'exhaust'; } },
  { k: 'safety', t: K('Door and belt while moving'), d: K('Door open, belt off'), f() { base(); S.m.soot = 40; S.m.doorL = true; S.m.belt = false; } },
];

/* ================= simulation ================= */
let last = now();
function sim(dt) {
  const m = S.m; const nowT = now(); const F = m.fault;
  ['preheat', 'crank', 'delay', 'neutralNeeded', 'mixUp', 'mixDown', 'halfUp', 'halfDown', 'horn'].forEach((k) => { if (m[k] > 0) m[k] = Math.max(0, m[k] - dt); });
  if (m.preheat === 0 && m._starting === 'preheat') { m._starting = 'crank'; m.crank = 1.2; }
  if (m.crank === 0 && m._starting === 'crank') { m._starting = null; m.engineOn = true; m.oilP = 320; m.transP = 15; m.battery = 26.8; m.fuelP = 500; }
  if (m.delay === 0 && m._stopping) { m._stopping = false; m.engineOn = false; }
  const regen = S.regen.running; const bt = S.bt.phase === 'running';

  let rpmT = 0;
  if (m.crank > 0) rpmT = 180;
  else if (m.engineOn) rpmT = regen ? 1400 : bt ? 1800 : P('idle') + m.throttle * (P('maxRpm') - P('idle')) + (m.ctrlRear && m.dir === 'N' ? m.rearAdd : 0);
  m.rpm = approach(m.rpm, clamp(rpmT, 0, 2400), 1800, dt);

  m.block = null;
  if (m.dir !== 'N' && m.throttle > 0.03 && m.engineOn) { if (m.parkBrake) m.block = 'park'; else if (regen) m.block = 'regen'; }
  const maxG = m.dir === 'R' ? P('maxR') : P('maxF');
  const vmax = [0, 8, 15, 25][maxG] * (m.dir === 'R' ? 0.6 : 1);
  let vT = 0;
  if (m.engineOn && m.dir !== 'N' && !m.block && !m.pedal && !bt) vT = m.throttle * vmax;
  if (bt && !m.pedal) vT = 2.5;
  const decel = m.pedal || m.parkBrake ? 14 : 4;
  m.speed = approach(m.speed, vT, vT > m.speed ? 3 : decel, dt);
  if (m.speed < 0.3) m.speed = 0;
  m.gear = m.dir === 'N' ? 0 : Math.max(1, Math.min(maxG, m.speed < 6 ? 1 : m.speed < 13 ? 2 : 3));
  m.lockup = m.dir === 'F' && m.engineOn && m.speed >= P('lockup') && m.throttle > 0.1;
  m.retarder = m.engineOn && m.dir !== 'N' && m.speed > P('retStart') && m.throttle < 0.05 && !m.pedal;
  const km = m.speed * dt / 3600; m.odo += km; m.trip += km;
  if (m.engineOn) m.hours += dt / 3600;

  const on = m.engineOn;
  m.coolant = approach(m.coolant, on ? 86 + m.throttle * 4 : Math.min(m.coolant, 45), on ? 0.6 : 0.2, dt);
  m.transT = approach(m.transT, on ? 74 + m.speed * 0.3 : Math.min(m.transT, 40), 0.4, dt);
  m.hyd = approach(m.hyd, m.hydTarget, 0.8, dt);
  m.oilP = approach(m.oilP, on ? (F.oilLow ? 140 : 220 + m.rpm * 0.1) : 0, 400, dt);
  m.fuelP = approach(m.fuelP, on ? 520 : 0, 600, dt);
  m.transP = approach(m.transP, on ? 16 + m.rpm / 600 : 0, 30, dt);
  m.boostP = approach(m.boostP, on ? 0.1 + m.throttle * 1.6 : 0, 2, dt);
  m.boostT = approach(m.boostT, on ? 40 + m.throttle * 25 : 20, 3, dt);
  m.battery = approach(m.battery, on ? 27.6 : (m.crank > 0 ? 21 : 24.4), 4, dt);
  m.exhaustT = approach(m.exhaustT, !on ? 60 : regen ? 610 : 260 + m.throttle * 180, regen ? 45 : 30, dt);
  if (on) m.fuel = Math.max(0, m.fuel - (0.2 + m.throttle) * dt * 0.0006);
  ['f', 'r', 'p'].forEach((c) => {
    const leak = c === 'f' && F.accLeakF;
    m.acc[c] = on && !leak ? approach(m.acc[c], 170 + (Math.random() - 0.5) * 2, 25, dt) : approach(m.acc[c], leak ? 92 : 150, leak ? 8 : 0.6, dt);
  });
  m.svc.f = approach(m.svc.f, m.pedal ? 115 : 0, 260, dt);
  m.svc.r = approach(m.svc.r, m.pedal ? 112 : 0, 260, dt);
  m.svc.p = approach(m.svc.p, m.parkBrake || !on ? 0 : 140, 320, dt);
  m.drumAct = on && !m.drumLock && !(m.ctrlRear && BUS.mrsOff) ? m.drumCmd : 0;

  if (!S._histT || nowT - S._histT > 1000) { S._histT = nowT; const h = G.hyd(); m.hydHist.push(h == null ? m.hyd : h); if (m.hydHist.length > 60) m.hydHist.shift(); }

  if (regen) {
    let why = null;
    if (!on) why = K('the engine stopped');
    else if (!m.parkBrake) why = K('the parking brake was released');
    else if (m.dir !== 'N') why = K('the drive lever left neutral');
    if (why) { S.regen.running = false; S.regen.confirmed = false; toast(['Regeneration stopped: {0}.', () => tx(why)], 'warn'); }
    else { m.soot = Math.max(6, m.soot - 1.6 * dt); if (m.soot <= 6.01) { S.regen.running = false; S.regen.done = true; S.regen.count++; toast(['Regeneration complete. Soot load is now {0}.', () => pct(6)]); } }
  }
  if (bt) {
    const b = S.bt; b.t += dt;
    b.max1 = Math.max(b.max1, C('FRONT_AXLE_SERVICE_PRESSURE') || 0); b.max2 = Math.max(b.max2, C('REAR_AXLE_SERVICE_PRESSURE') || 0);
    b.dist += m.speed / 3.6 * dt * 100;
    if (!on) { b.phase = 'fail'; b.reason = 'engine'; }
    else if (b.t >= 5) { b.phase = b.dist < 5 ? 'pass' : 'fail'; b.reason = b.dist < 5 ? '' : 'moved'; }
  }
  const u = S.svc.usb;
  if (u) {
    if (u.phase === 'countdown') { u.t -= dt; if (u.t <= 0) { u.phase = 'working'; u.p = 0; } }
    else if (u.phase === 'working') { u.p += dt / (u.kind === 'update' ? 5 : 3); if (u.p >= 1) { u.p = 1; u.phase = 'done'; } }
  }
  if (S.access && nowT > S.accessUntil) { S.access = 0; toast(['Logged out after 15 minutes. Back to Operator level.']); }
  if (S.toast && nowT > S.toast.until) S.toast = null;
  if (S.boot && nowT - S.boot.t0 > 4200) { S.boot = null; S.screen = 'drive'; }
  Object.keys(S.outputs).forEach((k) => { if (S.outputs[k] < nowT) delete S.outputs[k]; });
  transmit();
}

/* the machine side: pack the simulated state into BYM6 frames */
function transmit() {
  if (BUS.dropAll) return;
  const m = S.m; const F = m.fault; const on = m.engineOn; const ign = m.ign;
  const blink = Math.floor(now() / 500) % 2 === 0;
  const gF = m.dir === 'F' && ign; const gR = m.dir === 'R' && ign;
  const out = S.outputs;
  sendFrame(0x10, {
    LEFT_DOOR_SENSOR: m.doorL, RIGHT_DOOR_SENSOR: m.doorR,
    LEFT_SIGNAL: (m.sigL || m.hazard) && blink, RIGHT_SIGNAL: (m.sigR || m.hazard) && blink, FLASHER: m.hazard,
    FRONT_WORKING_LAMP: m.workF || !!out.workF, REAR_WORKING_LAMP: m.workR || !!out.workR, REVERSE_GEAR_LAMP: gR,
    WINDOW_RESISTANCE: m.windowHeat, LOCK_UP_ACTIVE_SYMBOL: m.lockup, STEERING_WHEEL_LOCKED: m.steerLock,
    MIXER_LOCKED_WARNING_SYMBOL: m.drumLock && m.drumCmd !== 0, HEADLIGHT: m.headlight, HORN: m.horn > 0 || !!out.horn,
    GEAR_FORWARD: gF, GEAR_NEUTRAL: m.dir === 'N' && ign, GEAR_REVERSE: gR,
    GEAR_FORWARD_1: gF && m.gear === 1, GEAR_FORWARD_2: gF && m.gear === 2, GEAR_FORWARD_3: gF && m.gear === 3,
    GEAR_REVERSE_1: gR && m.gear === 1, GEAR_REVERSE_2: gR && m.gear === 2, GEAR_REVERSE_3: gR && m.gear === 3,
    ENGINE_STATUS: on, ENGINE_WARNING: on && (m.oilP < 160 || m.coolant > 105 || !!F.oilLevel || m.dtcActive),
    ENGINE_OIL_LEVEL_LOW: !!F.oilLevel, PREHEAT_LAMP: m.preheat > 0, GEAR_NEUTRAL_NEEDED_WARNING: m.neutralNeeded > 0,
    WATER_IN_FUEL: !!F.water, PARKING_BRAKE_ACTIVE: m.parkBrake, AIR_FILTER_FAULT: !!F.airFilter,
    ENGINE_OIL_PRESSURE_WARNING: on && m.oilP < 160, IGNITION: ign, HYDRAULIC_OIL_TEMP_HIGH: m.hyd > 90,
    TRANSMISSION_OIL_PRESSURE_LOW: on && m.transP < 10, FUEL_LOW: m.fuel < 12, TRANSMISSION_TEMP_FAULT: m.transT > 110,
    HYDRAULIC_LEVEL_LOW: !!F.hydLevel, MIXER_TURNING_LEFT: m.drumAct === -1, MIXER_TURNING_RIGHT: m.drumAct === 1,
    HYDRAULIC_OIL_TEMPERATURE: m.hyd, TRANSMISSION_OIL_TEMPERATURE: m.transT,
  });
  sendFrame(0x20, {
    FRONT_AXLE_ACCUMULATOR_PRESSURE: m.acc.f, PARK_BRAKE_ACCUMULATOR_PRESSURE: m.acc.p, REAR_AXLE_ACCUMULATOR_PRESSURE: m.acc.r,
    TRANSMISSION_OIL_PRESSURE: m.transP, MIXER_CONTROL_AT_FRONT_SIDE: !m.ctrlRear, MIXER_CONTROL_AT_REAR_SIDE: m.ctrlRear,
    TRANSMISSION_FILTER_WARNING: !!F.transFilter, FUEL_LEVEL: m.fuel / 0.4, VEHICLE_SPEED_KM_H: m.speed,
  });
  sendFrame(0x30, { ENGINE_WORKING_HOUR: m.hours, ENGINE_SPEED: m.rpm });
  sendFrame(0x40, { ENGINE_OIL_PRESSURE: m.oilP, ENGINE_COOLANT_TEMPERATURE: m.coolant, BATTERY_VOLTAGE: m.battery });
  const accF = m.acc.f < 115; const accR = m.acc.r < 115; const accP = m.acc.p < 115;
  sendFrame(0x50, {
    FUEL_PRESSURE: m.fuelP, SEAT_BELT: !m.belt, AIR_CONDITIONER_GAS_LOW: !!F.acGas,
    FRONT_AXLE_ACCUMULATOR_FAULT: accF, REAR_AXLE_ACCUMULATOR_FAULT: accR, PARKING_BRAKE_ACCUMULATOR_FAULT: accP,
    FRONT_AXLE_SERVICE_PRESSURE: m.svc.f, REAR_AXLE_SERVICE_PRESSURE: F.svcSensR ? 0 : m.svc.r, PARKING_BRAKE_SERVICE_PRESSURE: m.svc.p,
  });
  sendFrame(0x70, { MIXER_RIGHT_COIL_CURRENT_MA: m.drumAct === 1 ? 620 : 0, MIXER_RIGHT_COIL_CURRENT_MA_2: m.drumAct === -1 ? 600 : 0, BOOST_TEMPERATURE: m.boostT, BOOST_PRESSURE: m.boostP });
  sendFrame(0x1300, {
    ENGINE_CRANKKING: m.crank > 0, ACTIVE_FAULT: m.dtcActive, PASSIVE_FAULT: m.dtcPassive, ENGINE_COOLANT_FAULT: m.coolant > 105,
    MIXER_LOCKED_SYMBOL: m.drumLock, TRANS_COIL_SHORT_CIRCUIT_WARNING: !!F.coilShort, REAR_ECU_MRS_STATUS: !BUS.mrsOff,
    GAS_PEDAL: m.throttle * 100 / 0.4, REAR_AXLE_SERVICE_SENSOR_FAULT: !!F.svcSensR,
    RETARDER_ACTIVE: m.retarder, GENERAL_ACCUMULA_FAULT_WARNING: accF || accR || accP,
    BATTERY_NOT_CHARGING_WARNING_1: on && m.battery < 25, BATTERY_NOT_CHARGING_WARNING_2: false,
    ENGINE_DELAY_ACTIVE: m.delay > 0, AC_SYSTEM_ACTIVE: m.ac && ign,
  });
  sendFrame(0x1400, {
    REVERSE_GEAR_LAMP_DATA_TO_MRS: gR, MIXER_CONTROL_REAR_TO_MRS: m.ctrlRear, MIXER_TURNING_LAMP_TO_MRS: m.drumAct !== 0,
    BRAKE_LAMP_TO_MRS: m.pedal, REAR_RIGHT_SIGNAL_TO_MRS: (m.sigR || m.hazard) && blink, REAR_LEFT_SIGNAL_TO_MRS: (m.sigL || m.hazard) && blink,
    REVERSE_GEAR_SIREN_TO_MRS: gR, MIXER_UP_COIL_TO_MRS: m.mixUp > 0 || !!out.mixUp, MIXER_DOWN_COIL_TO_MRS: m.mixDown > 0 || !!out.mixDown,
  });
  if (!BUS.mrsOff) sendFrame(0x1500, { MIXER_UP_FROM_MRS: m.ctrlRear && m.mixUp > 0, MIXER_DOWN_FROM_MRS: m.ctrlRear && m.mixDown > 0, MIXER_LOCK_FROM_MRS: m.drumLock, HALF_THROTHLE_INCREASE_FROM_MRS: m.halfUp > 0, HALF_THROTHLE_DECREASE_FROM_MRS: m.halfDown > 0 });
  const gOn = (n) => (on && m.dir !== 'N' && m.gear === n ? 700 : 0);
  sendFrame(0x1800, { LOCK_UP_GEAR_CURRENT: m.lockup ? 640 : 0, GEAR_3_CURRENT: gOn(3) });
  const lever = P('drumLever') * 10; const front = !m.ctrlRear;
  const lv = (want, isFront) => (m.drumCmd === want && front === isFront && !(m.ctrlRear && BUS.mrsOff) ? lever : 0);
  sendFrame(0x1900, { FRONT_MIXER_ROTATION_LEVER_RIGHT: lv(1, true), REAR_MIXER_ROTATION_LEVER_RIGHT: lv(1, false), FRONT_MIXER_ROTATION_LEVER_LEFT: lv(-1, true), REAR_MIXER_ROTATION_LEVER_LEFT: lv(-1, false) });
  sendFrame(0x2000, { FORWARD_GEAR_CURRENT: on && m.dir === 'F' ? 750 : 0, REVERSE_GEAR_CURRENT: on && m.dir === 'R' ? 750 : 0, GEAR_1_CURRENT: gOn(1), GEAR_2_CURRENT: F.gear2Open ? 0 : gOn(2) });
  const d = (i) => m.dtc[i] || { spn: 0, fmi: 0 };
  sendFrame(0x2800, { SPN_1_FAULT_CODE: d(0).spn, FMI_1_FAULT_CODE: d(0).fmi });
  sendFrame(0x2600, { SPN_2_FAULT_CODE: d(1).spn, SPN_3_FAULT_CODE: d(2).spn });
  sendFrame(0x2700, { SPN_4_FAULT_CODE: d(3).spn, SPN_5_FAULT_CODE: d(4).spn });
  sendFrame(0x2900, { FMI_2_FAULT_CODE: d(1).fmi, FMI_3_FAULT_CODE: d(2).fmi, FMI_4_FAULT_CODE: d(3).fmi, FMI_5_FAULT_CODE: d(4).fmi });
}

/* ================= modal / toast ================= */
function openModal(md) { if (S.modal && md.type === 'alarm') { S.modalQueue.push(md); return; } S.modal = md; }
function closeModal() { S.modal = S.modalQueue.shift() || null; }
function toast(msg, kind) { S.toast = { msg, kind: kind || 'ok', until: now() + 3800 }; }
const toastText = () => { const [k, ...a] = S.toast.msg; return tx(k, ...a.map((x) => (typeof x === 'function' ? x() : x))); };
function need(level, act, arg) { if (S.access >= level) return true; S.modal = { type: 'login', sel: level, code: '', err: '', need: level, then: act ? [act, arg] : null }; return false; }

/* ================= rendering ================= */
const NAV = [['drive', K('Drive')], ['exhaust', K('Exhaust')], ['alerts', K('Alerts')], ['mixer', K('Mixer')], ['engine', K('Diagnostics')], ['service', K('Service')]];
const SUBTITLE = {
  drive: () => { if (!ecuOk()) return tx('No data from ECU'); if (!one('IGNITION')) return tx('Ignition off'); if (!one('ENGINE_STATUS')) return tx('Engine off'); if (S.regen.running) return tx('Regenerating · parked'); if (one('PARKING_BRAKE_ACTIVE')) return tx('Parked'); return tx('Engine running · tram mode'); },
  exhaust: () => tx('Engine J1939 data · not in BYM6 · simulated'),
  alerts: () => tx('Most severe first'),
  mixer: () => { if (!fresh(0x10)) return tx('No data from ECU'); const d = drumDir(); return d === 1 ? tx('Drum turning right') : d === -1 ? tx('Drum turning left') : tx('Drum stopped'); },
  engine: () => tx({ engine: 'Diesel engine', valves: 'Clutch and drum coils', can: 'BYM6 CAN bus · live frames', brake: 'Brake system test' }[S.diag]),
  service: () => tx('Logs, settings, calibration'),
};
function topbar() {
  const act = activeAlerts(); const nA = act.filter((a) => a.sev === 'alarm'); const nW = act.filter((a) => a.sev === 'warn');
  let chips = '';
  if (!ecuOk()) chips += `<button class="chip alarm new" data-act="diagGo" data-arg="can">${I.plug}${tx('CAN lost')}</button>`;
  if (nA.length) chips += `<button class="chip alarm ${nA.some((a) => !a.acked) ? 'new' : ''}" data-act="nav" data-arg="alerts">${I.alerts}${tx(nA.length > 1 ? '{0} Alarms' : '{0} Alarm', nA.length)}</button>`;
  if (nW.length) chips += `<button class="chip warn ${nW.some((a) => !a.acked) ? 'new' : ''}" data-act="nav" data-arg="alerts">${I.warn}${tx(nW.length > 1 ? '{0} Warnings' : '{0} Warning', nW.length)}</button>`;
  if (!nA.length && !nW.length) chips += `<button class="chip clear" data-act="nav" data-arg="alerts">${tx('No active alerts')}</button>`;
  if (S.m.exhaustT > 450) chips += `<button class="chip hot" data-act="nav" data-arg="exhaust">${I.flame}${tx('Hot exhaust')}</button>`;
  const acc = S.access ? `<button class="tbtn lvl2" data-act="login">${I.key}${esc(tx('{0} · until {1}', lvlName(S.access), hhmm(S.accessUntil)))}</button>` : `<button class="tbtn" data-act="login">${I.user}${tx('Operator')}</button>`;
  const title = tx(NAV.find((n) => n[0] === S.screen)[1]);
  return `<header class="topbar"><div style="display:flex;gap:8px;align-items:center;flex:none">${chips}</div>
    <div class="top-title"><b>${esc(title)}</b><span data-live="sub">${esc(SUBTITLE[S.screen]())}</span></div>
    <button class="tbtn langsw" data-act="langToggle" aria-label="${esc(tx('Change language. Current: English'))}"><span class="${S.lang === 'en' ? 'on' : ''}">EN</span><span class="${S.lang === 'tr' ? 'on' : ''}">TR</span></button>
    <button class="tbtn" data-act="camera" aria-label="${esc(tx('Open cameras'))}">${I.camera}</button>
    <button class="tbtn" data-act="theme" aria-label="${esc(tx(S.theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'))}">${S.theme === 'night' ? I.sun : I.moon}</button>
    ${acc}<span class="clock" data-live="clock">${hhmm(now())}</span></header>`;
}
function rail() {
  return `<nav class="rail" aria-label="${esc(tx('Main menu'))}">${NAV.map(([k, label]) => {
    let extra = '';
    if (k === 'exhaust' && S.m.soot > 60) extra = `<span class="dot ${S.m.soot >= 80 ? 'red' : ''}"></span>`;
    if (k === 'alerts') { const n = S.alerts.filter((a) => a.active && !a.acked).length; if (n) extra = `<span class="badge">${n}</span>`; }
    if (k === 'mixer' && ecuOk() && !mrsOk()) extra = '<span class="dot"></span>';
    if (k === 'engine' && !ecuOk()) extra = '<span class="dot red"></span>';
    const on = S.screen === k;
    return `<button class="${on ? 'on' : ''}" data-act="nav" data-arg="${k}" ${on ? 'aria-current="page"' : ''}>${I[k]}<span>${esc(tx(label))}</span>${extra}</button>`;
  }).join('')}</nav>`;
}
const liveVal = (key, unit, unitStyle) => { const n = `<span data-live="${key}"></span>`; if (unit === '%' && S.lang === 'tr') return `<small style="${unitStyle || ''}">%</small>${n}`; return unit ? `${n} <small style="${unitStyle || ''}">${esc(tu(unit))}</small>` : n; };
const noDataBanner = () => (ecuOk() ? '' : `<div class="nodata">${I.plug}<b>${tx('No data from ECU')}</b><span>${tx('Values show –– until CAN frames arrive again.')}</span><button class="btn sm" data-act="diagGo" data-arg="can">${tx('Open CAN bus')}</button></div>`);

/* ---------- Drive ---------- */
const GAUGES = [
  { k: 'fuel', p: 'fuel', label: K('Fuel'), unit: '%', min: 0, max: 100, get: G.fuel, low: true, warn: 12, alarm: 5, bit: 'FUEL_LOW', bitSev: 'warn' },
  { k: 'coolant', p: 'coolant', label: K('Engine coolant'), unit: '°C', min: 20, max: 120, get: G.coolant, warn: 100, alarm: 105, bit: 'ENGINE_COOLANT_FAULT', bitSev: 'alarm' },
  { k: 'oilp', p: 'oil-pressure', label: K('Engine oil pressure'), unit: 'bar', min: 0, max: 7, get: G.oilBar, low: true, warn: 1.8, alarm: 1.6, bit: 'ENGINE_OIL_PRESSURE_WARNING', bitSev: 'alarm', d: 1, onlyRunning: true },
  { k: 'transT', p: 'trans-temp', label: K('Transmission oil'), unit: '°C', min: 0, max: 130, get: G.transT, warn: 100, alarm: 110, bit: 'TRANSMISSION_TEMP_FAULT', bitSev: 'alarm' },
  { k: 'transP', p: 'trans-pressure', label: K('Transmission pressure'), unit: 'bar', min: 0, max: 30, get: G.transP, low: true, warn: 12, alarm: 10, bit: 'TRANSMISSION_OIL_PRESSURE_LOW', bitSev: 'alarm', onlyRunning: true },
  { k: 'hyd', label: K('Hydraulic oil'), unit: '°C', min: 0, max: 110, get: G.hyd, warn: 85, alarm: 90, bit: 'HYDRAULIC_OIL_TEMP_HIGH', bitSev: 'alarm' },
];
const gPct = (g, v) => clamp((v - g.min) / (g.max - g.min) * 100, 0, 100);
const gState = (g) => {
  const v = g.get(); if (v == null) return 'nodata';
  if (g.bit && one(g.bit)) return g.bitSev;
  if (g.onlyRunning && !one('ENGINE_STATUS')) return 'ok';
  if (g.low) return v <= g.alarm ? 'alarm' : v <= g.warn ? 'warn' : 'ok';
  return v >= g.alarm ? 'alarm' : v >= g.warn ? 'warn' : 'ok';
};
function brakeCells() {
  return BRAKES.map((b) => {
    const st = brakeState(b); const accS = one(b.accS); const svcS = one(b.svcS);
    const val = (sg, bad) => (bad ? `<span class="sensbad">${tx('Sensor fault')}</span>` : `<b class="num" data-live="g2:${sg}"></b> <small>bar</small>`);
    const pill = st === 'alarm' ? `<span class="pill alarm">${tx('Accumulator fault')}</span>` : st === 'sensor' ? `<span class="pill warn">${tx('Sensor fault')}</span>` : st === 'nodata' ? `<span class="pill off">${NA}</span>` : `<span class="pill ok">${tx('OK')}</span>`;
    return `<div class="bcell ${st}"><div class="card-h"><span class="bhead">${pic(b.k === 'p' ? 'park-brake' : 'brake')}${tx(b.l)}</span>${pill}</div>
      <div class="brow"><span>${tx('Accumulator')}</span><span>${val(b.acc, accS)}</span></div>
      <div class="track" style="height:8px"><div class="fill" data-w="b:${b.acc}" style="${accS ? 'display:none' : ''}${st === 'alarm' ? ';background:var(--redTxt)' : ''}"></div><div class="tick" style="left:65%"></div></div>
      <div class="brow"><span>${tx(b.k === 'p' ? 'Release pressure' : 'Applied')}</span><span>${val(b.svc, svcS)}</span></div></div>`;
  }).join('');
}
function drumLine() {
  if (!fresh(0x10)) return '';
  const d = drumDir(); const lk = one('MIXER_LOCKED_SYMBOL'); const rear = one('MIXER_CONTROL_AT_REAR_SIDE');
  const dirTxt = d === 1 ? tx('Turning right') : d === -1 ? tx('Turning left') : tx('Stopped');
  return `<button class="drumline" data-act="nav" data-arg="mixer">${I.mixer}<b>${tx('Drum')}</b><span class="${d ? 'accc' : ''}">${esc(dirTxt)}</span>${lk ? `<span class="warnc">${pic('lock')}${tx('Locked')}</span>` : ''}<span class="mut">${tx('Control')}: ${tx(rear ? 'Rear station' : 'Cab')}</span><span class="mut" style="margin-left:auto">${tx('Coil')} <b class="num" data-live="drumCoil"></b> mA</span></button>`;
}
function scrDrive() {
  const gs = gearState();
  const dirs = ['R', 'N', 'F'].map((d) => `<span class="dirbox ${gs && gs.dir === d ? 'on' : ''}">${d}</span>`).join('');
  const band = dpfBand(); const dpfWarn = band !== 'L3'; const hint = startHint();
  const blockMsg = S.m.block === 'park' && ecuOk() ? tx('Parking brake on') : S.m.block === 'regen' ? tx('Regenerating') : null;
  const inds = activeInds(); const shown = inds.slice(0, 3); const more = inds.length - shown.length;
  const tt = (p, on, sev, label) => `<span class="tt ${on ? 'on-' + sev : ''}" title="${esc(tx(label))}" role="img" aria-label="${esc(tx(label))}${on ? '' : ' · ' + esc(tx('Off|light'))}">${pic(p)}</span>`;
  const gaugeRows = GAUGES.map((g) => `<div class="gauge st-${gState(g)}"><span class="gl">${g.p ? pic(g.p) : '<i class="pic none" aria-hidden="true"></i>'}${esc(tx(g.label))}</span><div class="track"><div class="fill" data-w="g:${g.k}"></div><div class="tick" style="left:${gPct(g, g.warn)}%"></div></div><span class="gv num">${liveVal('g:' + g.k, g.unit)}</span></div>`).join('');
  const lock = one('LOCK_UP_ACTIVE_SYMBOL'); const ret = one('RETARDER_ACTIVE');
  const pill = hint ? `<span class="pill ${hint[0] === 'warn' ? 'warn' : 'acc'} pillpic" style="height:34px;font-size:15px;margin-left:auto">${hint[2] ? pic(hint[2]) : ''}${esc(hint[1])}</span>` : blockMsg ? `<span class="pill warn" style="height:34px;font-size:15px;margin-left:auto">${esc(blockMsg)}</span>` : '';
  return `<main class="main"><div class="col" style="flex:1;gap:12px">
    ${noDataBanner()}
    <div style="flex:1;min-height:0;display:flex;gap:18px">
      <section class="col" style="width:490px;flex:none;gap:12px" aria-label="${esc(tx('Speed and drivetrain'))}">
        <div class="card" style="flex:1;padding:14px 22px;display:flex;flex-direction:column;justify-content:space-between">
          <div class="sigrow"><span class="sig" data-sig="L" aria-hidden="true">${pic('signal')}</span><span class="sig" data-sig="R" aria-hidden="true">${pic('signal', 'flip')}</span>${tt('park-brake', one('PARKING_BRAKE_ACTIVE'), 'alarm', K('Parking brake on'))}${tt('seat-belt', one('SEAT_BELT'), 'warn', K('Seat belt not fastened'))}${tt('headlight', one('HEADLIGHT'), 'info', K('Headlights'))}${tt('hazard', one('FLASHER'), 'warn', K('Hazard lights'))}${pill}</div>
          <div style="display:flex;align-items:flex-end;gap:14px"><span class="num" style="font-size:150px;line-height:.82;letter-spacing:-.02em" data-live="speed">0</span><span class="mut" style="font-size:26px;font-weight:500;padding-bottom:6px">${tu('km/h')}</span>
            <span style="margin-left:auto;text-align:right;padding-bottom:4px"><span class="mut" style="font-size:14px;display:block">${tx('Gas pedal')}</span><span class="num" style="font-size:26px">${liveVal('pedal', '%', 'font:500 14px Barlow;color:var(--mut)')}</span></span></div>
          <div style="display:flex;align-items:center;gap:10px">${dirs}<div style="margin-left:12px;display:flex;flex-direction:column;gap:5px"><span class="num" style="font-size:36px;line-height:1" data-live="gear"></span>
            <span style="display:flex;gap:6px"><span class="pill pillpic ${lock ? 'acc' : 'off'}" style="height:28px;font-size:13px">${pic('lockup')}${tx('LOCK-UP')}</span><span class="pill pillpic ${ret ? 'acc' : 'off'}" style="height:28px;font-size:13px">${pic('retarder')}${tx('RETARDER')}</span></span></div></div>
          ${drumLine()}
        </div>
        <div class="card" style="padding:10px 22px 12px"><div class="card-h" style="margin-bottom:6px"><span class="mut" style="font-size:16px;font-weight:500">${tx('Engine speed')}</span><span class="num" style="font-size:26px"><span data-live="rpm"></span> <small class="mut" style="font:500 16px Barlow,sans-serif">${tu('rpm')}</small></span></div>
          <div class="track" style="height:14px;border-radius:4px;overflow:hidden"><div style="position:absolute;left:84.6%;top:0;bottom:0;width:7.7%;background:var(--amberSoft)"></div><div style="position:absolute;left:92.3%;top:0;bottom:0;right:0;background:var(--redSoft)"></div><div class="fill" data-w="rpm" style="border-radius:0"></div></div></div>
        <button class="card ${band === 'L3' ? '' : band === 'L4' || band === 'L5' ? 'warn' : 'alarm'}" data-act="nav" data-arg="exhaust" style="display:flex;align-items:center;gap:14px;padding:10px 16px 10px 20px;min-height:64px;text-align:left;width:100%">
          <span style="flex:1;display:flex;flex-direction:column;gap:7px"><span class="card-h"><span style="font-size:16px;font-weight:600">${tx('Exhaust filter (DPF)')}</span><span style="font-size:15px;color:var(--txt2)">${tx('Soot')} ${S.lang === 'tr' ? '%<span data-live="soot"></span>' : '<span data-live="soot"></span> %'} · ${esc(band === 'L3' ? tx('Normal') : tx('Level {0}', band.slice(1)))}</span></span>
            <span class="track" style="height:8px;display:block"><span class="fill" data-w="soot" style="${dpfWarn ? 'background:var(--amber)' : ''}"></span></span></span>
          <span class="btn sm ${dpfWarn ? 'amber' : ''}">${tx(S.regen.running ? 'Running' : dpfWarn ? 'Regenerate' : 'Details')}</span></button>
      </section>
      <div class="col" style="flex:1;min-width:0;gap:12px">
        <section class="card" style="flex:1;min-width:0;padding:8px 18px;display:flex;flex-direction:column" aria-label="${esc(tx('Fluids, temperatures and pressures'))}">
          <div class="card-h" style="padding-bottom:4px;border-bottom:1px solid var(--line)"><span class="mut" style="font-size:16px;font-weight:500">${tx('Fluids, temperatures and pressures')}</span><span style="font-size:14px;color:var(--faint)">${tx('Tick = warning limit')}</span></div>${gaugeRows}</section>
        <section class="card" style="flex:none;padding:10px 14px" aria-label="${esc(tx('Brakes · three circuits'))}">
          <div class="card-h" style="margin-bottom:8px"><span class="mut" style="font-size:16px;font-weight:500">${tx('Brakes · three circuits')}</span><span style="font-size:14px;color:var(--faint)">${tx('Tick = 130 bar')}</span></div>
          <div class="bgrid">${brakeCells()}</div></section>
      </div>
    </div>
    <section style="height:62px;flex:none;display:flex;align-items:center;gap:10px;background:var(--panel2);border:1px solid var(--line);border-radius:14px;padding:0 12px" aria-label="${esc(tx('Active now'))}">
      <span class="kicker" style="width:92px;flex:none;line-height:1.2">${tx('Active now')}</span>
      <div class="indrow">${shown.map((i) => { const lab = i.k === 'dpf' && S.regen.running ? tx('Regenerating') : tx(i.l); return `<button class="ind ${i.st}" data-act="indGo" data-arg="${i.k}" title="${esc(lab)}">${i.p ? pic(i.p) : ''}${esc(lab)}</button>`; }).join('')}
      ${more > 0 ? `<button class="ind go" style="flex:none" data-act="indAll">${tx('+{0} more', more)}</button>` : ''}</div>
      <button class="ind go" style="flex:none" data-act="indAll">${tx('All indicators')}</button></section>
    <section style="height:40px;flex:none;display:flex;align-items:center;gap:22px;padding:0 6px;font-size:16px;color:var(--mut);white-space:nowrap" aria-label="${esc(tx('Trip data'))}">
      <span>${tx('Odometer')} <b class="num" style="font-size:22px;color:var(--txt)" data-live="odo"></b> km</span>
      <span>${tx('Trip')} <b class="num" style="font-size:22px;color:var(--txt)" data-live="trip"></b> km</span>
      <button class="btn sm hold" data-hold="resetTrip" aria-label="${esc(tx('Hold for 2 seconds to reset trip'))}"><span class="prog"></span><span style="position:relative">${tx('Hold to reset trip')}</span></button>
      <span class="iconval" title="${esc(tx('Engine hours'))}">${pic('hours')}<b class="num" style="font-size:22px;color:var(--txt)" data-live="hours"></b> ${tu('h')}</span>
      <span class="iconval" title="${esc(tx('Battery'))}">${pic('battery')}<b class="num" style="font-size:22px;color:var(--txt)" data-live="battery"></b> V</span>
      <span class="iconval" title="${esc(tx('Boost pressure'))}">${pic('turbo')}<b class="num" style="font-size:22px;color:var(--txt)" data-live="boost"></b> bar</span></section>
  </div></main>`;
}

/* ---------- Exhaust (J1939, not in BYM6) ---------- */
function scrExhaust() {
  const m = S.m; const r = S.regen; const band = dpfBand();
  const LV = [['L3', pct('0–60'), K('Normal. No action needed.')], ['L4', pct('61–69'), K('Regenerate as soon as possible.')], ['L5', pct('70–79'), K('Regenerate now. Warning lamp flashes.')], ['L6', pct('80–99'), K('Service tool needed. Engine derated. Call the workshop.')], ['max', pct('100'), K('Filter must be removed. Call the workshop now.')]];
  const sevOf = { L3: 'ok', L4: 'warn', L5: 'warn', L6: 'alarm', max: 'alarm' };
  const badge = { L3: ['ok', K('Normal')], L4: ['warn', K('Level 4 · regenerate soon')], L5: ['warn', K('Level 5 · regenerate now')], L6: ['alarm', K('Level 6 · workshop')], max: ['alarm', K('Full · workshop')] }[band];
  const checks = regenChecks(); const allAuto = checks.every((c) => c.ok);
  const needed = m.soot > 60 && m.soot < 80; const ready = allAuto && !r.inhibit && r.confirmed && needed;
  const left = checks.filter((c) => !c.ok).length + (r.inhibit ? 1 : 0) + (r.confirmed ? 0 : 1);
  const sootLive = S.lang === 'tr' ? '%<span data-live="soot"></span>' : '<span data-live="soot"></span> %';
  let right;
  if (r.running) {
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:18px;justify-content:center"><div style="display:flex;align-items:center;gap:12px;color:var(--hot);font-size:21px;font-weight:700"><span style="width:30px;height:30px">${I.flame}</span>${tx('Regeneration running · exhaust is very hot')}</div>
      <div><div class="card-h" style="font-size:16px;color:var(--mut);margin-bottom:8px"><span>${tx('Soot burned')}</span><span style="color:var(--txt)">${pct(f0(r.from))} → ${sootLive}</span></div><div class="progress"><div data-w="regen"></div></div>
      <p class="mini" style="margin-top:8px">${tx('Exhaust')} <b data-live="exhaustT" style="color:var(--txt)"></b> °C · ${tx('engine at high idle')} <b data-live="rpm" style="color:var(--txt)"></b> ${tu('rpm')}. ${tx('Demo runs about 30 times faster than a real regeneration.')}</p></div>
      <ul style="margin:0;padding-left:22px;font-size:17px;line-height:1.6;color:var(--txt2)"><li>${tx('Driving and drum controls are locked.')}</li><li>${tx('Releasing the parking brake or leaving neutral stops it.')}</li><li>${tx('Keep people 0.6 m and anything flammable 1.5 m from the outlet.')}</li></ul>
      <button class="btn block" data-act="regenStop">${I.stop}${tx('Stop regeneration')}</button></div>`;
  } else if (r.done) {
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;text-align:center"><span style="width:64px;height:64px;color:var(--ok)">${I.okc}</span><h2 style="margin:0;font-size:28px">${tx('Regeneration complete')}</h2><p class="mini" style="font-size:17px">${tx('Soot load now:')} <b style="color:var(--txt)">${sootLive}</b>. ${tx('The exhaust stays hot for a few minutes.')}</p><button class="btn pri" data-act="regenDone" style="min-width:240px">${tx('Done')}</button></div>`;
  } else {
    const startTxt = ready ? I.play + tx('Start regeneration') : !needed ? tx('Regeneration not available') : tx(left === 1 ? '{0} check left before you can start' : '{0} checks left before you can start', left);
    right = `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px">
      ${checks.map((c) => `<li class="check ${c.ok ? '' : 'bad'}" style="min-height:46px"><span class="${c.ok ? 'okdot' : 'baddot'}"></span><span class="ct">${esc(c.l)}<small>${tx('From CAN')}</small></span><span class="cv">${esc(c.v)}</span></li>`).join('')}
      <li class="check ${r.inhibit ? 'bad' : ''}"><span class="${r.inhibit ? 'baddot' : 'okdot'}"></span><span class="ct">${tx('Regeneration inhibit switch')}<small>${tx(r.inhibit ? 'Set to Permit, or regeneration cannot start.' : 'Permit. Regeneration is allowed.')}</small></span><button class="btn sm ${r.inhibit ? 'pri' : ''}" data-act="inhibit" style="min-width:132px">${tx(r.inhibit ? 'Set Permit' : 'Set Inhibit')}</button></li>
      <li class="check ${r.confirmed ? '' : 'bad'}"><span class="${r.confirmed ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('Exhaust area is clear')}<small>${tx('Nothing that can burn, melt or explode within 1.5 m. Nobody within 0.6 m.')}</small></span><button class="btn sm ${r.confirmed ? '' : 'pri'}" data-act="confirmArea" aria-pressed="${r.confirmed}" style="min-width:132px">${tx(r.confirmed ? 'Confirmed' : 'I checked')}</button></li>
    </ul><div style="flex:1"></div>${!needed ? `<p class="mini" style="text-align:center">${tx(m.soot >= 80 ? 'Too full for a standstill regeneration. A service tool is needed.' : 'Not needed yet. Soot is below 61 %.')}</p>` : ''}
    <button class="btn ${ready ? 'go' : ''} block" data-act="regenStart" ${ready ? '' : 'disabled'} style="min-height:62px;font-size:20px">${startTxt}</button>`;
  }
  return `<main class="main">
    <section class="col" style="width:540px;flex:none;gap:12px" aria-label="${esc(tx('Particulate filter · soot load'))}">
      <div class="srcnote">${I.plug}<span>${tx('Soot, ash and DEF are not in BYM6.dbc. They need the engine J1939 aftertreatment messages. Simulated here.')}</span></div>
      <div class="card pad"><div class="card-h" style="align-items:flex-start"><div><div class="mut" style="font-size:16px;font-weight:500">${tx('Particulate filter · soot load')}</div>
        <div class="num" style="font-size:80px;line-height:.92;color:${band === 'L3' ? 'var(--txt)' : sevOf[band] === 'warn' ? 'var(--amberTxt)' : 'var(--redTxt)'}">${S.lang === 'tr' ? '<span style="font-size:38px">%</span><span data-live="soot"></span>' : '<span data-live="soot"></span><span style="font-size:38px">%</span>'}</div></div>
        <span class="pill ${badge[0] === 'ok' ? 'ok' : badge[0]}" style="height:38px;font-size:16px">${tx(badge[1])}</span></div>
        <div style="margin-top:12px;position:relative"><div style="display:flex;height:20px;border-radius:5px;overflow:hidden;gap:2px"><div style="width:60%;background:var(--line3)"></div><div style="width:10%;background:#8A6A33"></div><div style="width:10%;background:#C58A2E"></div><div style="width:20%;background:#A9372F"></div></div><div data-left="soot" style="position:absolute;top:-6px;height:32px;width:5px;margin-left:-2px;border-radius:2px;background:var(--txt);box-shadow:0 0 0 2px var(--panel)"></div></div></div>
      <div class="card" style="flex:1;padding:6px;display:flex;flex-direction:column;gap:2px">
        ${LV.map(([k, rg, w]) => { const on = k === band; const s = sevOf[k]; return `<div style="flex:1;display:flex;align-items:center;gap:12px;padding:0 12px;border-radius:8px;${on ? (s === 'ok' ? 'background:var(--panel3);' : s === 'warn' ? 'background:var(--amberSoft);box-shadow:inset 0 0 0 1px var(--amber);color:var(--amberTxt);' : 'background:var(--redSoft);box-shadow:inset 0 0 0 1px var(--red);color:var(--redTxt);') : 'color:var(--txt2);'}"><span class="num" style="font-size:21px;width:52px">${k === 'max' ? tx('Max') : k.replace('L', tx('L|level abbr'))}</span><span style="font-size:15px;width:76px;color:var(--mut)">${rg}</span><span style="flex:1;font-size:16px;line-height:1.25">${tx(w)}</span>${on ? `<span class="pill on" style="height:26px;font-size:13px">${tx('NOW')}</span>` : ''}</div>`; }).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        <div class="stat"><div class="k">${tx('Ash load')}</div><div class="v">${S.lang === 'tr' ? '<small>%</small>' + m.ash : m.ash + '<small> %</small>'}</div></div>
        <div class="stat"><div class="k">${tx('DEF tank')}</div><div class="v">${S.lang === 'tr' ? '<small>%</small>' + m.def : m.def + '<small> %</small>'}</div></div>
        <div class="stat"><div class="k">${tx('Engine derate')}</div><div class="v" style="${m.soot >= 80 ? 'color:var(--redTxt)' : ''}">${tx(m.soot >= 80 ? 'Active' : 'None')}</div></div></div>
    </section>
    <section class="card" style="flex:1;min-width:0;padding:20px 24px;display:flex;flex-direction:column;gap:12px" aria-label="${esc(tx('Standstill regeneration'))}">
      <div><h2 style="margin:0;font-size:26px;font-weight:600">${tx('Standstill regeneration')}</h2><p class="mini" style="font-size:16px;margin-top:4px">${tx('The engine burns off soot at high idle. Stay with the machine until it finishes. Checks update live from the machine.')}</p></div>${right}</section>
  </main>`;
}

/* ---------- Alerts ---------- */
function scrAlerts() {
  const act = activeAlerts(); const hist = historyAlerts(); const isAct = S.alertTab === 'active'; const list = isAct ? act : hist;
  let sel = byId(S.alertSel); if (!sel || !list.includes(sel)) sel = list[0] || null; if (sel) S.alertSel = sel.id;
  const rows = list.map((a) => { const d = a.def; const sub = isAct ? `${tf(d.sub)} · ${ago(a.t0)}` : tx('Cleared {0} · lasted {1}', hhmm(a.t1), dur(a.t1 - a.t0));
    return `<button class="arow ${sel && sel.id === a.id ? 'sel' : ''}" data-act="aSel" data-arg="${a.id}"><span class="sev ${a.sev}">${a.sev === 'info' ? 'i' : '!'}</span>${d.p ? `<span class="rowpic">${pic(d.p)}</span>` : ''}<span style="flex:1;min-width:0"><span class="t">${esc(tf(d.title))}</span><span class="s">${esc(sub)}</span></span>${isAct ? (a.acked ? `<span class="pill off">${tx('Seen')}</span>` : `<span class="pill on">${tx('New')}</span>`) : `<span class="pill off">${tx('Cleared')}</span>`}</button>`; }).join('');
  let detail;
  if (!sel) detail = `<section class="card" style="flex:1;min-width:0;padding:20px 24px;display:flex"><div class="empty"><span style="width:56px;height:56px;color:var(--ok)">${I.okc}</span>${tx(isAct ? 'No active alerts. The machine is OK.' : 'History is empty.')}</div></section>`;
  else {
    const d = sel.def; const bc = sel.sev === 'alarm' ? 'var(--red)' : sel.sev === 'warn' ? 'var(--amber)' : 'var(--line)';
    const trend = d.trend ? `<div style="background:var(--panel2);border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:16px"><svg width="430" height="70" viewBox="0 0 430 70" role="img" aria-label="${esc(tx('Hydraulic oil temperature over the last minute'))}"><line x1="0" y1="${70 - 35 * 1.4}" x2="430" y2="${70 - 35 * 1.4}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="5 4"/><line x1="0" y1="${70 - 40 * 1.4}" x2="430" y2="${70 - 40 * 1.4}" stroke="var(--redTxt)" stroke-width="1.5" stroke-dasharray="5 4"/><polyline data-points="hyd" fill="none" stroke="var(--txt)" stroke-width="3" stroke-linejoin="round"/></svg><div class="mini">${tx('Last 60 s')}<br><span style="color:var(--amberTxt)">${tx('85 °C warning')}</span><br><span style="color:var(--redTxt)">${tx('90 °C alarm')}</span></div></div>` : '';
    const when = sel.active ? tx('Started {0} · {1}', ago(sel.t0), hhmm(sel.t0)) : `${hhmm(sel.t0)}–${hhmm(sel.t1)}`;
    detail = `<section class="card" style="flex:1;min-width:0;padding:20px 24px;display:flex;flex-direction:column;gap:14px;border-color:${bc}" aria-label="${esc(tx('Alert detail'))}">
      <div class="card-h" style="align-items:center"><span class="pill ${sel.sev === 'info' ? 'off' : sel.sev}" style="height:34px;font-size:16px">${tx(SEVNAME[sel.sev])}</span><span class="mono mut" style="font-size:14px;flex:1;margin-left:12px">${esc(tx('Code {0} · {1}', d.code, tx(d.src)))}</span><span class="mut" style="font-size:15px">${esc(when)}</span></div>
      <h2 class="titlepic" style="margin:0;font-size:30px;line-height:1.15;font-weight:600">${d.p ? pic(d.p, 'lg') : ''}${esc(tf(d.title))}</h2>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px"><div style="background:var(--panel2);border-radius:12px;padding:12px 16px"><div class="kicker" style="margin-bottom:6px">${tx('What is happening')}</div><div style="font-size:17px;line-height:1.4">${esc(tf(d.what))}</div></div><div style="background:var(--panel2);border-radius:12px;padding:12px 16px"><div class="kicker" style="margin-bottom:6px">${tx('Effect on the machine')}</div><div style="font-size:17px;line-height:1.4">${esc(tf(d.effect))}</div></div></div>
      <div><div class="kicker" style="margin-bottom:6px">${tx('What to do')}</div><ol style="margin:0;padding-left:26px;font-size:18px;line-height:1.5">${d.steps.map((s) => `<li>${esc(tf(s))}</li>`).join('')}</ol></div>
      ${trend}<div style="flex:1"></div>
      <div style="display:flex;gap:12px">${sel.active ? `<button class="btn ${sel.acked ? '' : 'pri'}" style="flex:1" data-act="ack" data-arg="${sel.id}" ${sel.acked ? 'disabled' : ''}>${tx(sel.acked ? 'Acknowledged' : 'Acknowledge')}</button>` : ''}${d.link ? `<button class="btn" style="flex:1" data-act="${d.link[2] ? 'diagGo' : 'nav'}" data-arg="${d.link[2] || d.link[0]}">${esc(tx(d.link[1]))}</button>` : ''}</div></section>`;
  }
  const unacked = act.filter((a) => !a.acked).length;
  return `<main class="main"><section class="col" style="width:500px;flex:none;gap:12px" aria-label="${esc(tx('Alert list'))}">
      <div class="tabs" role="tablist"><button role="tab" class="${isAct ? 'on' : ''}" aria-selected="${isAct}" data-act="aTab" data-arg="active">${tx('Active · {0}', act.length)}</button><button role="tab" class="${!isAct ? 'on' : ''}" aria-selected="${!isAct}" data-act="aTab" data-arg="history">${tx('History · {0}', hist.length)}</button></div>
      <div class="alist">${rows || `<div class="empty">${tx(isAct ? 'Nothing active.' : 'No cleared alerts.')}</div>`}</div>
      <div style="display:flex;gap:10px">${isAct ? `<button class="btn sm" style="flex:1" data-act="ackAll" ${unacked ? '' : 'disabled'}>${tx('Acknowledge all')}${unacked ? ' · ' + unacked : ''}</button>` : `<button class="btn sm" style="flex:1" data-act="saveAlertsUsb">${I.usb}${tx('Save to USB')}</button><button class="btn sm" style="flex:1" data-act="clearHist" ${hist.length ? '' : 'disabled'}>${S.access < 1 ? I.lock : ''}${tx('Clear history')}</button>`}</div>
    </section>${detail}</main>`;
}

/* ---------- Mixer ---------- */
function scrMixer() {
  const d = drumDir(); const lockSym = one('MIXER_LOCKED_SYMBOL'); const rear = one('MIXER_CONTROL_AT_REAR_SIDE'); const front = one('MIXER_CONTROL_AT_FRONT_SIDE');
  const mOk = mrsOk(); const any = fresh(0x10);
  const dirTxt = !any ? NA : d === 1 ? tx('Turning right') : d === -1 ? tx('Turning left') : tx('Stopped');
  const modeTxt = !any ? '' : d === 1 ? tx('Mixing') : d === -1 ? tx('Discharging') : lockSym ? tx('Locked') : tx('Idle');
  const dc = dischargeChecks(); const bad = dc.filter((c) => !c.ok).length;
  const levers = [['FRONT_MIXER_ROTATION_LEVER_RIGHT', K('Cab · turn right')], ['FRONT_MIXER_ROTATION_LEVER_LEFT', K('Cab · turn left')], ['REAR_MIXER_ROTATION_LEVER_RIGHT', K('Rear · turn right')], ['REAR_MIXER_ROTATION_LEVER_LEFT', K('Rear · turn left')]];
  const chip = (on, a, b, k) => `<span class="pill ${on == null ? 'off' : on ? (k || 'on') : 'off'}">${on == null ? NA : tx(on ? a : b)}</span>`;
  return `<main class="main">
    <section class="card mixmap" aria-label="${esc(tx('Mixer drum · side view'))}">
      <div class="card-h" style="position:absolute;left:20px;top:16px;right:20px"><span class="mut" style="font-size:16px;font-weight:500">${tx('Mixer drum · side view')}</span><span class="pill ${mOk ? 'ok' : 'warn'}">${tx(mOk ? 'Rear station online' : 'Rear station offline')}</span></div>
      <div class="truck">
        <div class="cab ${front ? 'ctl' : ''}"><span>${tx('Cab')}</span>${front ? `<b>${tx('In control')}</b>` : ''}</div>
        <div class="drum ${d === 1 ? 'spinR' : d === -1 ? 'spinL' : ''} ${lockSym ? 'locked' : ''}"><div class="stripes"></div>${lockSym ? `<span class="lockbadge">${pic('lock')}${tx('Locked')}</span>` : ''}</div>
        <div class="rearst ${rear ? 'ctl' : ''} ${mOk ? '' : 'off'}"><span>${tx('Rear station')}</span>${rear ? `<b>${tx('In control')}</b>` : ''}</div>
        <div class="chassis"></div><span class="wheel" style="left:44px"></span><span class="wheel" style="left:262px"></span><span class="wheel" style="left:326px"></span>
      </div>
      <div class="drumtxt"><div class="num" style="font-size:40px;line-height:1">${esc(dirTxt)}</div><div class="mut" style="font-size:18px">${esc(modeTxt)}${modeTxt && d !== 0 ? ` <span style="font-size:13px">(${tx('assumed')})</span>` : ''}</div></div>
      <div class="kv" style="position:absolute;left:20px;right:20px;bottom:18px;grid-template-columns:1fr 1fr">
        <div><span>${tx('Right coil')}</span><b class="num" style="font-size:22px"><span data-live="c:MIXER_RIGHT_COIL_CURRENT_MA"></span> mA</b></div>
        <div><span>${tx('Left coil')}</span><b class="num" style="font-size:22px"><span data-live="c:MIXER_RIGHT_COIL_CURRENT_MA_2"></span> mA</b></div></div>
    </section>
    <div class="col" style="flex:1;gap:12px">
      <section class="card pad ${bad ? 'warn' : ''}"><div class="card-h" style="margin-bottom:6px;align-items:center"><h2>${tx('Ready to discharge?')}</h2>${bad ? `<span class="pill warn" style="height:34px;font-size:15px">${tx(bad > 1 ? 'Not yet · {0} items' : 'Not yet · {0} item', bad)}</span>` : `<span class="pill ok" style="height:34px;font-size:15px">${tx('Ready')}</span>`}</div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 20px">${dc.map((c) => `<div style="display:flex;align-items:center;gap:12px;height:34px;font-size:16px;${c.ok ? '' : 'color:var(--amberTxt)'}"><span class="${c.ok ? 'okdot' : 'baddot'}"></span>${esc(c.l)}</div>`).join('')}</div></section>
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:6px"><div class="card-h"><h2>${tx('Rotation levers')}</h2><span class="mut" style="font-size:14px">${tx('Raw 0–1000 assumed = 0–100 %')}</span></div>
        ${levers.map(([sg, l]) => `<div class="lever"><span>${tx(l)}</span><div class="track" style="height:12px"><div class="fill" data-w="lv:${sg}" style="background:var(--accent)"></div></div><b class="num">${liveVal('lv:' + sg, '%')}</b><span class="mono mut" style="font-size:12px;width:56px;text-align:right" data-live="raw:${sg}"></span></div>`).join('')}</section>
      <section class="card pad" style="flex:none"><div class="card-h" style="margin-bottom:8px"><h2 style="font-size:19px">${tx('Rear station (MRS) signals')}</h2><span class="mut mono" style="font-size:13px">0x1400 · 0x1500</span></div>
        <div class="kv" style="grid-template-columns:repeat(3,1fr)">
          <div><span>${tx('Mixer up')}</span>${chip(B('MIXER_UP_FROM_MRS'), 'On|output', 'Off|output', 'acc')}</div>
          <div><span>${tx('Mixer down')}</span>${chip(B('MIXER_DOWN_FROM_MRS'), 'On|output', 'Off|output', 'acc')}</div>
          <div><span>${tx('Lock switch')}</span>${chip(B('MIXER_LOCK_FROM_MRS'), 'On|output', 'Off|output', 'warn')}</div>
          <div><span>${tx('Half-throttle +')}</span>${chip(B('HALF_THROTHLE_INCREASE_FROM_MRS'), 'On|output', 'Off|output', 'acc')}</div>
          <div><span>${tx('Half-throttle −')}</span>${chip(B('HALF_THROTHLE_DECREASE_FROM_MRS'), 'On|output', 'Off|output', 'acc')}</div>
          <div><span>${tx('Brake lamp')}</span>${chip(B('BRAKE_LAMP_TO_MRS'), 'On|light', 'Off|light', 'acc')}</div></div></section>
    </div></main>`;
}

/* ---------- Diagnostics ---------- */
const numU = (key, unit, size) => `<b class="num" style="font-size:${size || 24}px">${liveVal(key, unit, 'font:500 15px Barlow;color:var(--mut)')}</b>`;
const onOff = (n, l, k, pp) => { const v = B(n); return `<div><span class="kvl">${pic(pp)}${tx(l)}</span><span class="pill ${v == null ? 'off' : v ? (k || 'on') : 'off'}">${v == null ? NA : tx(v ? 'On|output' : 'Off|output')}</span></div>`; };
function scrEngine() {
  const tabs = [['engine', K('Engine')], ['valves', K('Valves')], ['can', K('CAN bus')], ['brake', K('Brake test')]];
  let body = '';
  if (S.diag === 'engine') {
    const kv = [[K('Engine speed'), 'rpm', 'rpm', ''], [K('Coolant temperature'), 'g:coolant', '°C', 'coolant'], [K('Oil pressure'), 'oilKpa', 'kPa', 'oil-pressure'], [K('Fuel pressure'), 'fuelP', 'kPa', 'fuel-pressure'], [K('Boost pressure'), 'boost', 'bar', 'turbo'], [K('Boost temperature'), 'boostT', '°C', 'turbo'], [K('Battery'), 'battery', 'V', 'battery'], [K('Gas pedal'), 'pedal', '%', ''], [K('Engine hours'), 'hours', 'h', 'hours']];
    const dtcs = dtcList(); const act = one('ACTIVE_FAULT'); const pas = one('PASSIVE_FAULT');
    body = `<div style="display:flex;gap:20px;flex:1;min-height:0">
      <section class="card pad" style="flex:1.3;display:flex;flex-direction:column;gap:10px"><div class="card-h"><h2>${tx('Diesel engine')}</h2><span class="pill ${one('ENGINE_STATUS') ? 'ok' : 'off'}">${tx(one('ENGINE_STATUS') ? 'Running' : 'Stopped')}</span></div>
        <div class="kv">${kv.map(([l, k, u, pp]) => `<div><span class="kvl">${pic(pp)}${tx(l)}</span>${numU(k, u)}</div>`).join('')}${onOff('IGNITION', K('Ignition'))}${onOff('PREHEAT_LAMP', K('Preheating'), 'acc', 'preheat')}${onOff('ENGINE_CRANKKING', K('Cranking'), 'acc', 'key')}${onOff('ENGINE_DELAY_ACTIVE', K('Engine cool-down'), 'acc', 'engine-shutoff')}${onOff('ENGINE_WARNING', K('Engine warning'), 'warn', 'engine')}</div></section>
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:10px"><div class="card-h"><h2>${tx('Engine fault codes')}</h2><span class="mut" style="font-size:14px">J1939 SPN / FMI</span></div>
        <div style="display:flex;gap:8px"><span class="pill ${act ? 'warn' : 'off'}">${tx('Active fault lamp')}</span><span class="pill ${pas ? 'acc' : 'off'}">${tx('Passive fault lamp')}</span></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;overflow:auto">${dtcs.length ? dtcs.map((x) => `<div class="dtc"><div class="mono" style="font-size:14px;color:var(--mut)">SPN ${x.spn} · FMI ${x.fmi == null ? '?' : x.fmi}</div><div style="font-size:18px;font-weight:600">${esc(spnName(x.spn))}</div><div class="mini">${esc(fmiName(x.fmi))}</div></div>`).join('') : `<div class="empty" style="font-size:16px">${tx('No fault codes reported.')}</div>`}</div>
        <p class="mini">${tx('Up to 5 codes from messages 0x2600–0x2900. Names follow the J1939 standard. Confirm with the engine maker.')}</p></section></div>`;
  } else if (S.diag === 'valves') {
    const rows = valveRows();
    const stPill = (r) => ({ ok: `<span class="pill ok">${tx('OK')}</span>`, open: `<span class="pill alarm">${tx('No current · open circuit?')}</span>`, unexpected: `<span class="pill warn">${tx('Current when off')}</span>`, nodata: `<span class="pill off">${NA}</span>` }[r.st]);
    body = `<div style="display:flex;gap:20px;flex:1;min-height:0">
      <section class="card pad" style="flex:1.5;display:flex;flex-direction:column;gap:8px;overflow:auto"><div class="card-h"><h2>${tx('Commanded vs measured')}</h2><span class="mut" style="font-size:14px">${tx('On = above 200 mA')}</span></div>
        <table class="table"><thead><tr><th>${tx('Coil')}</th><th>${tx('Should be')}</th><th class="r">${tx('Measured')}</th><th class="r">${tx('Status')}</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${tx(r.l)}<div class="mono mut" style="font-size:12px">${r.sig}</div></td><td>${tx(r.want ? 'On|output' : 'Off|output')}</td><td class="r num" style="font-size:20px"><span data-live="c:${r.sig}"></span> mA</td><td class="r">${stPill(r)}</td></tr>`).join('')}</tbody></table></section>
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:10px"><div class="card-h"><h2>${tx('Transmission')}</h2></div>
        <div class="kv" style="grid-template-columns:1fr"><div><span>${tx('Selected')}</span><b class="num" style="font-size:22px" data-live="gearCode"></b></div><div><span>${tx('Oil pressure')}</span>${numU('g:transP', 'bar', 22)}</div><div><span>${tx('Oil temperature')}</span>${numU('g:transT', '°C', 22)}</div>
          ${onOff('TRANS_COIL_SHORT_CIRCUIT_WARNING', K('Coil short circuit'), 'alarm')}${onOff('TRANSMISSION_PRESS_SENSOR_FAULT', K('Pressure sensor fault'), 'warn')}${onOff('TRANSMISSION_FILTER_WARNING', K('Filter warning'), 'warn')}${onOff('LOCK_UP_ACTIVE_SYMBOL', K('Lock-up active'), 'acc', 'lockup')}${onOff('RETARDER_ACTIVE', K('Retarder active'), 'acc', 'retarder')}</div>
        <p class="mini">${tx('A clutch that is commanded but draws no current points to a broken wire or coil.')}</p></section></div>`;
  } else if (S.diag === 'can') {
    const sel = MSG[S.canSel] || DB.messages[0]; const stale = DB.messages.filter((x) => !fresh(x.id)).length;
    body = `<div style="display:flex;gap:16px;flex:1;min-height:0">
      <section class="card pad" style="width:430px;flex:none;display:flex;flex-direction:column;gap:8px"><div class="card-h"><h2>${tx('Messages')}</h2><span class="pill ${stale ? 'warn' : 'ok'}">${tx('{0} of {1} live', DB.messages.length - stale, DB.messages.length)}</span></div>
        <p class="mini" style="font-size:13px">${esc(tx('Source {0} · extended IDs · timeout 1 s (assumed, the DBC has no cycle times)', DB.source || 'BYM6.dbc'))}</p>
        <div style="flex:1;overflow:auto;display:flex;flex-direction:column;gap:5px">${DB.messages.map((x) => `<button class="canrow ${x.id === sel.id ? 'sel' : ''} ${fresh(x.id) ? '' : 'stale'}" data-act="canSel" data-arg="${x.id}"><span class="mono" style="width:64px">${hexId(x.id)}</span><span class="mono hex" data-live="hex:${x.id}"></span><span class="mono age" data-live="age:${x.id}"></span></button>`).join('')}</div></section>
      <section class="card pad" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px"><div class="card-h"><h2>${hexId(sel.id)} · ${esc(sel.name)}</h2><span class="pill ${fresh(sel.id) ? 'ok' : 'alarm'}">${tx(fresh(sel.id) ? 'Live' : 'Stale')}</span></div>
        <div style="flex:1;overflow:auto"><table class="table cantbl"><thead><tr><th>${tx('Signal')}</th><th class="r">${tx('Bits')}</th><th class="r">${tx('Raw')}</th><th class="r">${tx('Value')}</th><th>${tx('Unit')}</th></tr></thead><tbody>
        ${sel.signals.map((s) => { const a = ASSUME[s.name]; const u = s.unit || (a && a.unit) || ''; return `<tr><td class="mono">${s.name}${a && a.note ? `<div class="note">${esc(tx(a.note))}</div>` : ''}</td><td class="r mono">${s.start}|${s.len}</td><td class="r mono" data-live="raw:${s.name}"></td><td class="r mono" data-live="val:${s.name}"></td><td>${esc(u)}${!s.unit && u ? '<span class="assumed">*</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="mini" style="font-size:13px">${tx('* Unit not in the DBC. Assumed for display.')}</p></section></div>`;
  } else body = brakeTestBody();
  return `<main class="main"><div class="col" style="flex:1;gap:14px"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${S.diag === k ? 'on' : ''}" aria-selected="${S.diag === k}" data-act="diag" data-arg="${k}">${tx(l)}</button>`).join('')}</div>${body}</div></main>`;
}
function brakeTestBody() {
  const b = S.bt; const checks = btChecks(); const ok = checks.every((c) => c.ok) && b.area;
  let right;
  if (b.phase === 'setup') {
    right = `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px">${checks.map((c) => `<li class="check ${c.ok ? '' : 'bad'}"><span class="${c.ok ? 'okdot' : 'baddot'}"></span><span class="ct">${esc(c.l)}${c.hint && !c.ok ? `<small>${esc(c.hint)}</small>` : ''}</span><span class="cv">${esc(c.v)}</span></li>`).join('')}
      <li class="check ${b.area ? '' : 'bad'}"><span class="${b.area ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('Area in front of the machine is clear')}<small>${tx('The machine may move if a brake fails.')}</small></span><button class="btn sm ${b.area ? '' : 'pri'}" data-act="btArea" style="min-width:132px">${tx(b.area ? 'Confirmed' : 'I checked')}</button></li></ul>
      <div style="flex:1"></div><button class="btn ${ok ? 'go' : ''} block" data-act="btStart" ${ok ? '' : 'disabled'} style="min-height:62px;font-size:20px">${ok ? I.play + tx('Start 5 second brake test') : tx('Complete the checks to start')}</button>`;
  } else if (b.phase === 'running') {
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:18px;justify-content:center"><div style="font-size:22px;font-weight:700;color:var(--accent)">${tx('Test running · keep the pedal pressed')}</div><div class="progress"><div data-w="bt"></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px"><div class="stat"><div class="k">${tx('Time')}</div><div class="v"><span data-live="btT"></span><small> ${tu('s')}</small></div></div><div class="stat"><div class="k">${tx('Distance moved')}</div><div class="v"><span data-live="btDist"></span><small> cm</small></div></div><div class="stat"><div class="k">${tx('Engine')}</div><div class="v"><span data-live="rpm"></span><small> ${tu('rpm')}</small></div></div></div>
      <p class="mini">${tx('Engine pulls against the service brakes. Release the pedal in the reviewer panel to see a failed test.')}</p></div>`;
  } else {
    const pass = b.phase === 'pass'; const reason = b.reason === 'engine' ? tx('The engine stopped during the test.') : b.reason === 'moved' ? tx('The machine moved {0} cm. The brakes did not hold.', f0(b.dist)) : '';
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center"><div style="display:flex;align-items:center;gap:14px"><span style="width:56px;height:56px;color:${pass ? 'var(--ok)' : 'var(--redTxt)'}">${pass ? I.okc : I.xc}</span><div><h2 style="margin:0;font-size:30px">${tx(pass ? 'Brake test passed' : 'Brake test failed')}</h2><p class="mini" style="font-size:16px">${pass ? tx('The machine held still for 5 seconds.') : esc(reason)}</p></div></div>
      <table class="table"><tbody><tr><td>${tx('Distance moved')}</td><td class="r">${f0(b.dist)} cm</td></tr><tr><td>${tx('Front axle applied, max')}</td><td class="r">${f0(b.max1)} bar</td></tr><tr><td>${tx('Rear axle applied, max')}</td><td class="r">${f0(b.max2)} bar</td></tr></tbody></table>
      <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="btReset">${tx('Run again')}</button><button class="btn ${b.saved ? '' : 'pri'}" style="flex:1" data-act="btSave" ${b.saved ? 'disabled' : ''}>${tx(b.saved ? 'Report saved' : 'Save report')}</button></div></div>`;
  }
  return `<div style="display:flex;gap:20px;flex:1;min-height:0"><section class="card pad" style="width:430px;flex:none;display:flex;flex-direction:column;gap:10px"><div class="card-h"><h2>${tx('Brake pressures')}</h2><span class="mut" style="font-size:15px">${tx('Live')}</span></div><div class="bgrid" style="grid-template-columns:1fr">${brakeCells()}</div><p class="mini">${tx('Opened with the Brake TEST key in the cab, or from here.')}</p></section>
    <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:12px"><div class="card-h"><h2>${tx('Service brake test')}</h2>${S.reports.length ? `<span class="mut" style="font-size:15px">${tx(S.reports.length > 1 ? '{0} reports saved' : '{0} report saved', S.reports.length)}</span>` : ''}</div>${right}</section></div>`;
}

/* ---------- Service ---------- */
const DIR = [
  { g: K('Logs and data'), items: [{ l: K('Alarm log'), k: 'alarm history log alerts', act: 'alertHistory' }, { l: K('Operating hours'), k: 'hours usage time distance energy fuel', p: 'hours' }, { l: K('Copy data to USB'), k: 'usb export drive usage data report', p: 'usb:data' }, { l: K('Version info'), k: 'software firmware version', p: 'version' }] },
  { g: K('Display'), items: [{ l: K('Brightness'), k: 'screen dim backlight', p: 'display' }, { l: K('Day / night'), k: 'theme dark light mode', p: 'display' }, { l: K('Language'), k: 'language english turkish türkçe', p: 'display' }, { l: K('Time'), k: 'clock time zone utc offset', p: 'display' }] },
  { g: K('Calibration'), items: [{ l: K('Drum levers'), k: 'mixer drum lever calibration', p: 'calib:lever', lvl: 2 }, { l: K('Gas pedal'), k: 'pedal accelerator calibration', p: 'calib:pedal', lvl: 2 }, { l: K('Brake circuit'), k: 'brake test circuit', act: 'brakeTest' }, { l: K('Outputs'), k: 'output test valve light coil', p: 'outputs', lvl: 2 }] },
  { g: K('Engine and drivetrain'), items: [{ l: K('Engine'), k: 'idle rpm engine speed cool-down', p: 'params:engine' }, { l: K('Transmission'), k: 'gear shift lock-up', p: 'params:trans' }, { l: K('Retarder'), k: 'retarder brake', p: 'params:retarder' }, { l: K('Mixer drum'), k: 'mixer drum lever rear half throttle', p: 'params:mixer' }] },
  { g: K('Diagnostics'), items: [{ l: K('Diesel engine'), k: 'engine diesel fault code spn fmi', act: 'diagGo', arg: 'engine' }, { l: K('Valves'), k: 'coil current clutch solenoid', act: 'diagGo', arg: 'valves' }, { l: K('CAN bus'), k: 'can bus dbc frame message signal', act: 'diagGo', arg: 'can' }, { l: K('Brake test'), k: 'brake test', act: 'brakeTest' }, { l: K('Cameras'), k: 'camera view', act: 'camera' }] },
  { g: K('System'), items: [{ l: K('Access level'), k: 'login password code access', act: 'login' }, { l: K('Backup'), k: 'backup usb', p: 'usb:backup', lvl: 2 }, { l: K('Update'), k: 'update software usb', p: 'usb:update', lvl: 2 }, { l: K('Change history'), k: 'history undo parameter log', p: 'history' }, { l: K('Serial no.'), k: 'serial number', p: 'params:system', lvl: 3 }, { l: K('Factory defaults'), k: 'factory reset defaults', p: 'defaults', lvl: 3 }] },
];
const trLower = (s) => s.toLocaleLowerCase(S.lang === 'tr' ? 'tr-TR' : 'en-US');
function renderDir() {
  const q = trLower(S.svc.q.trim()); let hits = 0;
  const html = DIR.map((g, gi) => {
    const items = g.items.map((it, ii) => ({ it, ii })).filter(({ it }) => !q || trLower([it.l, it.k || '', g.g, tx(it.l), tx(g.g)].join(' ')).includes(q));
    hits += items.length; if (!items.length) return '';
    return `<div class="dgrp"><span style="font-size:17px;font-weight:600">${tx(g.g)}</span><div class="items">${items.map(({ it, ii }) => { const locked = (it.lvl || 0) > S.access; const sel = it.p && S.svc.panel === it.p; return `<button class="ditem ${locked ? 'locked' : ''} ${sel ? 'sel' : ''}" data-act="svcItem" data-arg="${gi}:${ii}">${locked ? I.lock : ''}${tx(it.l)}</button>`; }).join('')}</div></div>`;
  }).join('');
  return hits ? html : `<div class="empty" style="grid-column:1/-1">${esc(tx('No match for “{0}”.', S.svc.q))}<button class="btn sm" data-act="svcClearQ">${tx('Clear search')}</button></div>`;
}
const histName = (h) => { const f = findParam(h.id); const nm = f ? tx(f.p.name) : h.id; return h.isUndo ? nm + ' ' + tx('(undo)') : nm; };
function svcPanel() {
  const s = S.svc; const p = s.panel;
  const head = (crumb, title) => `<div style="display:flex;align-items:center;gap:10px"><button class="tbtn" data-act="svcHome" aria-label="${esc(tx('Back to overview'))}">${I.back}</button><div><div class="mut" style="font-size:14px">${esc(crumb)}</div><h2 style="margin:0;font-size:24px;line-height:1.2">${esc(title)}</h2></div></div>`;
  if (p === 'home') {
    const recent = S.phist.slice(-3).reverse();
    return `<div class="card-h"><h2>${tx('Service overview')}</h2><span class="pill ${S.access ? 'acc' : 'off'}">${lvlName(S.access)}</span></div>
      <div style="background:var(--panel2);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Next service')}</span><span style="font-size:20px;font-weight:600">${tx('Engine oil and filters')}</span><span class="mini">${tx('Due in {0} · every 250 engine hours (example interval)', `<b style="color:var(--txt)">69 ${tu('h')}</b>`)}</span></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Recent parameter changes')}</span>${recent.length ? recent.map((h) => `<div class="kv" style="grid-template-columns:1fr"><div><span>${esc(histName(h))}</span><span class="mono" style="font-size:14px">${h.old} → ${h.nw} ${esc(tu(h.unit))} · ${hhmm(h.t)}</span></div></div>`).join('') : `<p class="mini">${tx('None this session. Open Engine and drivetrain to change one.')}</p>`}</div>
      <div style="flex:1"></div><div style="display:flex;gap:10px">${S.access ? `<button class="btn" style="flex:1" data-act="logout">${tx('Log out')}</button>` : `<button class="btn pri" style="flex:1" data-act="login">${I.key}${tx('Log in for maintenance')}</button>`}<button class="btn" style="flex:1" data-act="svcOpen" data-arg="history">${tx('Change history')}</button></div>`;
  }
  if (p.startsWith('params:')) {
    const gk = p.split(':')[1]; const g = PARAMS[gk]; const cur = s.param && g.items.find((x) => x.id === s.param);
    const crumb = gk === 'system' ? tx('System') : tx('Engine and drivetrain');
    if (!cur) return `${head(crumb, tx(g.title))}<div style="display:flex;flex-direction:column;gap:8px">${g.items.map((x) => `<button class="prow" data-act="pSel" data-arg="${x.id}"><span class="pn">${tx(x.name)}<small>${esc(tx('Range {0}–{1} {2} · default {3}', x.min, x.max, tu(x.unit), x.def))}</small></span><span class="num pv">${withUnit(PV[x.id], x.unit).replace(/ (\S+)$/, ' <small class="mut" style="font:500 15px Barlow">$1</small>')}</span></button>`).join('')}</div><div style="flex:1"></div><p class="mini">${tx('Everyone can view parameters. Changing them needs {0} level.', lvlName(g.items[0].level || 2))}</p>`;
    const lvl = cur.level || 2; const u = tu(cur.unit);
    const intro = `${head(tx(g.title), tx(cur.name))}<div style="display:flex;gap:10px;font-size:15px;color:var(--mut);flex-wrap:wrap"><span>${tx('Now')} <b style="color:var(--txt)">${withUnit(PV[cur.id], cur.unit)}</b></span><span>·</span><span>${tx('Range')} ${cur.min}–${cur.max} ${u}</span><span>·</span><span>${tx('Default')} ${withUnit(cur.def, cur.unit)}</span></div>`;
    if (s.mode === 'view') return `${intro}<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px"><span class="num" style="font-size:96px;line-height:1">${PV[cur.id]}</span><span class="mut" style="font-size:20px">${u || '&nbsp;'}</span></div><div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="pList">${tx('All values')}</button><button class="btn pri" style="flex:1.3" data-act="pEdit">${S.access < lvl ? I.lock + tx('Log in to change') : tx('Change value')}</button></div>`;
    const n = s.entry === '' ? NaN : parseInt(s.entry, 10); const okR = !isNaN(n) && n >= cur.min && n <= cur.max; const changed = okR && n !== PV[cur.id];
    if (s.mode === 'edit') {
      let msg = '', mc = 'var(--mut)';
      if (s.entry === '') msg = tx('Type a value between {0} and {1}.', cur.min, cur.max);
      else if (!okR) { msg = tx('Out of range. Allowed {0}–{1} {2}.', cur.min, cur.max, u); mc = 'var(--redTxt)'; }
      else if (!changed) msg = tx('Same as the current value.');
      else { msg = tx('1 unsaved change: {0} → {1} {2} ({3})', PV[cur.id], n, u, (n > PV[cur.id] ? '+' : '') + (n - PV[cur.id])); mc = 'var(--amberTxt)'; }
      return `${intro}<div class="entry ${s.entry !== '' && !okR ? 'bad' : changed ? 'chg' : ''}"><span class="mut" style="font-size:15px">${tx('New value')}</span><span class="num">${s.entry === '' ? '–' : esc(s.entry)} <small class="mut" style="font:500 18px Barlow">${u}</small></span></div><div style="font-size:15px;color:${mc};min-height:20px">${esc(msg)}</div>
        <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => `<button data-act="key" data-arg="${k}">${k}</button>`).join('')}<button data-act="keyClr" style="font-size:18px">${tx('Clear|keypad')}</button><button data-act="key" data-arg="0">0</button><button data-act="keyDel" aria-label="${esc(tx('Delete last digit'))}">⌫</button></div>
        <div style="flex:1"></div><div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="pCancel">${tx('Cancel')}</button><button class="btn pri" style="flex:1.4" data-act="pReview" ${changed ? '' : 'disabled'}>${tx('Review and save')}</button></div>`;
    }
    return `${intro}<div style="flex:1;display:flex;flex-direction:column;gap:16px;justify-content:center"><div style="font-size:20px;font-weight:600">${tx('Save this change?')}</div>
      <div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:center;background:var(--panel2);border-radius:12px;padding:18px;text-align:center"><div><div class="mut" style="font-size:14px">${tx('Before')}</div><div class="num mut" style="font-size:42px;text-decoration:line-through">${PV[cur.id]}</div></div><div class="mut" style="font-size:26px">→</div><div><div class="mut" style="font-size:14px">${tx('After')}</div><div class="num" style="font-size:42px">${n}</div></div></div>
      <ul style="margin:0;padding-left:22px;font-size:16px;line-height:1.55;color:var(--txt2)"><li>${tx('Takes effect straight away in this demo.')}</li><li>${tx('Logged with your access level and the time.')}</li><li>${tx('Undo any time from Change history.')}</li></ul></div>
      <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="pBack">${tx('Back')}</button><button class="btn go" style="flex:1.4" data-act="pSave">${tx('Save 1 change')}</button></div>`;
  }
  if (p === 'history') return `${head(tx('System'), tx('Change history'))}<div style="flex:1;overflow:auto">${S.phist.length ? `<table class="table"><thead><tr><th>${tx('Time')}</th><th>${tx('Parameter')}</th><th class="r">${tx('Change')}</th><th>${tx('By')}</th><th></th></tr></thead><tbody>${S.phist.slice().reverse().map((h) => `<tr><td>${hhmm(h.t)}</td><td>${esc(histName(h))}</td><td class="r mono" style="font-size:14px">${h.old} → ${h.nw} ${esc(tu(h.unit))}</td><td>${esc(lvlName(h.by))}</td><td class="r">${h.undone ? `<span class="mut" style="font-size:14px">${tx('Undone')}</span>` : `<button class="btn sm" data-act="undo" data-arg="${h.i}">${I.undo}${tx('Undo')}</button>`}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${tx('No changes yet. Change a parameter and it shows up here with an Undo button.')}</div>`}</div>`;
  if (p === 'hours') return `${head(tx('Logs and data'), tx('Operating hours'))}<table class="table"><tbody><tr><td>${tx('Engine hours')}</td><td class="r"><span data-live="hours"></span> ${tu('h')}</td></tr><tr><td>${tx('Driving hours')}</td><td class="r">1 204 ${tu('h')}</td></tr><tr><td>${tx('Drum hours')}</td><td class="r">1 466 ${tu('h')}</td></tr><tr><td>${tx('Distance')}</td><td class="r"><span data-live="odo"></span> km</td></tr><tr><td>${tx('Regenerations')}</td><td class="r">${S.regen.count}</td></tr></tbody></table><p class="mini">${tx('Engine hours come from CAN (0x30). Other figures are examples.')}</p><div style="flex:1"></div><button class="btn pri" data-act="svcOpen" data-arg="usb:data">${I.usb}${tx('Copy drive and usage data to USB')}</button>`;
  if (p === 'version') return `${head(tx('Logs and data'), tx('Version info'))}<table class="table"><tbody><tr><td>${tx('Machine ECU')}</td><td class="r mono" style="font-size:14px">3.4.12</td></tr><tr><td>${tx('Rear ECU (MRS)')}</td><td class="r mono" style="font-size:14px">${mrsOk() ? '1.2.3' : NA}</td></tr><tr><td>${tx('Display')}</td><td class="r mono" style="font-size:14px">0.9.0-concept</td></tr><tr><td>${tx('CAN database')}</td><td class="r mono" style="font-size:14px">${esc(DB.source || 'BYM6.dbc')} · ${DB.messages.length} msg</td></tr><tr><td>${tx('Machine serial')}</td><td class="r mono" style="font-size:14px">${PV.serial}</td></tr></tbody></table><p class="mini">${tx('Example version numbers only.')}</p>`;
  if (p === 'display') return `${head(tx('Display'), tx('Display settings'))}
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker" id="brightLbl">${esc(tx('Brightness · {0}', pct(S.bright)))}</span><input type="range" min="30" max="100" step="5" value="${S.bright}" data-input="bright" aria-label="${esc(tx('Brightness'))}" style="width:100%;height:44px;accent-color:var(--accent)"></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Mode')}</span><div class="tabs"><button class="${S.theme === 'night' ? 'on' : ''}" data-act="theme" data-arg="night">${tx('Night · underground')}</button><button class="${S.theme === 'day' ? 'on' : ''}" data-act="theme" data-arg="day">${tx('Day · bright light')}</button></div></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Language')}</span><div class="tabs">${LANGS.map(([k, l]) => `<button class="${S.lang === k ? 'on' : ''}" data-act="lang" data-arg="${k}" lang="${k}">${l}</button>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Time · UTC offset')}</span><div style="display:flex;align-items:center;gap:12px"><button class="btn sm" data-act="tz" data-arg="-1" aria-label="${esc(tx('Minus one hour'))}">−1 ${tu('h')}</button><span class="num" style="font-size:30px;min-width:120px;text-align:center">${S.tz >= 0 ? '+' : ''}${S.tz} ${tu('h')}</span><button class="btn sm" data-act="tz" data-arg="1" aria-label="${esc(tx('Plus one hour'))}">+1 ${tu('h')}</button><span class="mut" style="font-size:16px">${tx('Clock shows')} <b data-live="clock" style="color:var(--txt)"></b></span></div></div>`;
  if (p.startsWith('usb:')) {
    const kind = p.split(':')[1]; const u = s.usb || (s.usb = { kind, phase: 'prep', inserted: false, estop: false, p: 0 });
    const TITLE = { data: K('Copy drive and usage data'), alerts: K('Save alerts to USB'), backup: K('Full system backup'), update: K('Software update') };
    if (u.phase === 'prep') {
      const ok = u.estop && u.inserted;
      return `${head('USB', tx(TITLE[kind]))}<p class="mini" style="font-size:16px">${tx('USB work needs the emergency stop pressed first, so nothing can move while files are written.')}</p>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px">
          <li class="check ${u.estop ? '' : 'bad'}"><span class="${u.estop ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('Emergency stop pressed')}<small>${tx('Not on the CAN bus. Confirm it yourself.')}</small></span><button class="btn sm ${u.estop ? '' : 'pri'}" data-act="usbEstop" style="min-width:132px">${tx(u.estop ? 'Confirmed' : 'I pressed it')}</button></li>
          <li class="check ${u.inserted ? '' : 'bad'}"><span class="${u.inserted ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('USB stick inserted')}<small>${u.inserted ? esc(tx('NORSMART_USB · {0} GB free', f1(7.4))) : tx('Port is behind the seat.')}</small></span>${u.inserted ? '' : `<button class="btn sm pri" data-act="usbInsert" ${u.estop ? '' : 'disabled'}>${I.usb}${tx('Insert stick')}</button>`}</li>
        </ul><div style="flex:1"></div><button class="btn ${ok ? 'go' : ''} block" data-act="usbStart" ${ok ? '' : 'disabled'}>${tx(kind === 'update' ? 'Start update' : 'Start')}</button>`;
    }
    if (u.phase === 'countdown') return `${head('USB', tx(TITLE[kind]))}<div style="flex:1;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;text-align:center"><span class="num" style="font-size:96px;line-height:1" data-live="usbT"></span><span style="font-size:20px">${tx('Update starts automatically')}</span><p class="mini">${tx('Remove the stick now to cancel. The real system waits 30 s. The demo waits 10 s.')}</p></div><button class="btn danger block" data-act="usbCancel">${tx('Remove stick and cancel')}</button>`;
    if (u.phase === 'working') return `${head('USB', tx(TITLE[kind]))}<div style="flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center"><span style="font-size:20px;font-weight:600">${tx(kind === 'update' ? 'Updating modules… do not switch off' : 'Writing to USB…')}</span><div class="progress"><div data-w="usb"></div></div></div>`;
    const DONE = { data: K('Data copied'), alerts: K('Alerts saved'), backup: K('Backup written'), update: K('Update installed') };
    return `${head('USB', tx(TITLE[kind]))}<div style="flex:1;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;text-align:center"><span style="width:60px;height:60px;color:var(--ok)">${I.okc}</span><span style="font-size:22px;font-weight:600">${tx(DONE[kind])}</span><p class="mini">${kind === 'update' ? tx('Restart the machine to finish.') : kind === 'backup' ? esc(tx('backup_{0}.tar is on the stick. Remove the stick and release the emergency stop.', PV.serial)) : tx('Remove the stick and release the emergency stop.')}</p></div>${kind === 'update' ? `<button class="btn go block" data-act="restart">${tx('Restart now')}</button>` : `<button class="btn pri block" data-act="usbDone">${tx('Done')}</button>`}`;
  }
  if (p.startsWith('calib:')) {
    const kind = p.split(':')[1]; const c = s.calib && s.calib.kind === kind ? s.calib : (s.calib = { kind, step: 0, cap: [] });
    const NAMES = { lever: [K('Rear drum lever, turn right'), K('Release the lever fully'), K('Hold it halfway'), K('Push it fully')], pedal: [K('Gas pedal'), K('Release the pedal fully'), K('Press it halfway'), K('Press it fully down')] }[kind];
    const steps = NAMES.slice(1); const STEPN = [K('Minimum'), K('Centre'), K('Maximum')]; const SHORT = [K('Min'), K('Centre'), K('Max')]; const CAP = [K('Capture minimum'), K('Capture centre'), K('Capture maximum')];
    const sigName = kind === 'lever' ? 'REAR_MIXER_ROTATION_LEVER_RIGHT' : 'GAS_PEDAL';
    if (c.step < 3) return `${head(tx('Calibration'), tx(NAMES[0]))}
        <div style="display:flex;gap:8px">${steps.map((x, i) => `<span class="pill ${i < c.step ? 'ok' : i === c.step ? 'acc' : 'off'}" style="flex:1;justify-content:center;height:34px">${i + 1}. ${tx(STEPN[i])}</span>`).join('')}</div>
        <div style="font-size:22px;font-weight:600;margin-top:6px">${esc(tx('{0}, then tap {1}.', tx(steps[c.step]), tx('Capture')))}</div>
        <div><div class="card-h mut" style="font-size:15px;margin-bottom:6px"><span>${tx('Live raw value')} · <span class="mono">${sigName}</span></span><b class="num" style="font-size:24px;color:var(--txt)" data-live="sensor"></b></div><div class="track" style="height:18px"><div class="fill" data-w="sensor" style="background:var(--accent);transition:none"></div></div></div>
        <div class="kv" style="grid-template-columns:repeat(3,1fr)">${SHORT.map((l, i) => `<div><span>${tx(l)}</span><b class="num" style="font-size:22px">${c.cap[i] != null ? c.cap[i] : '–'}</b></div>`).join('')}</div>
        <div style="flex:1"></div><div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="calRedo">${tx('Start over')}</button><button class="btn pri" style="flex:1.4" data-act="calCap">${tx(CAP[c.step])}</button></div>`;
    const okc = c.cap[0] < c.cap[1] && c.cap[1] < c.cap[2];
    return `${head(tx('Calibration'), tx(NAMES[0]))}<div class="kv" style="grid-template-columns:repeat(3,1fr)">${SHORT.map((l, i) => `<div><span>${tx(l)}</span><b class="num" style="font-size:22px">${c.cap[i]}</b></div>`).join('')}</div>
      <div class="check ${okc ? '' : 'bad'}"><span class="${okc ? 'okdot' : 'baddot'}"></span><span class="ct">${tx(okc ? 'Values are in order and spread enough.' : 'Values are out of order. Start over and follow the steps.')}<small>${tx('These raw limits become the 0–100 % scaling the DBC leaves open.')}</small></span></div>
      <div style="flex:1"></div><div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="calRedo">${tx('Start over')}</button><button class="btn go" style="flex:1.4" data-act="calSave" ${okc ? '' : 'disabled'}>${tx('Save calibration')}</button></div>`;
  }
  if (p === 'outputs') {
    const OUTS = [['workF', K('Front work lamps'), 'FRONT_WORKING_LAMP'], ['workR', K('Rear work lamps'), 'REAR_WORKING_LAMP'], ['horn', K('Horn'), 'HORN'], ['mixUp', K('Mixer up coil'), 'MIXER_UP_COIL_TO_MRS'], ['mixDown', K('Mixer down coil'), 'MIXER_DOWN_COIL_TO_MRS']];
    return `${head(tx('Calibration'), tx('Output test'))}<p class="mini" style="font-size:16px">${tx('Each test switches the output on for 2 seconds. Coil tests need the parking brake on. The state shown is read back from CAN.')}</p>
      <div style="display:flex;flex-direction:column;gap:8px">${OUTS.map(([k, l, sg]) => { const on = S.outputs[k] > now(); const fb = B(sg); return `<div class="prow"><span class="pn">${tx(l)}<small class="mono">${sg}</small></span><span class="pill ${fb ? 'acc' : 'off'}">${fb == null ? NA : tx(fb ? 'On|output' : 'Off|output')}</span><button class="btn sm" data-act="outTest" data-arg="${k}" ${on ? 'disabled' : ''}>${tx('Test {0}', '2 ' + tu('s'))}</button></div>`; }).join('')}</div>`;
  }
  if (p === 'defaults') return `${head(tx('System'), tx('Factory defaults'))}<p style="font-size:17px;line-height:1.45;color:var(--txt2);margin:0">${tx('Puts every engine and drivetrain parameter back to its factory value. Calibrations and logs are kept. Each reset value is written to Change history, so it can be undone.')}</p><div style="flex:1"></div><button class="btn danger block" data-act="defaultsAsk">${tx('Restore factory defaults')}</button>`;
  return '';
}
function scrService() {
  return `<main class="main"><section class="col" style="width:620px;flex:none;gap:14px" aria-label="${esc(tx('Service directory'))}">
      <label class="search">${I.search}<span class="sr">${tx('Search service functions')}</span><input id="svcSearch" type="search" placeholder="${esc(tx('Search: gear coil, brake test, language…'))}" value="${esc(S.svc.q)}" autocomplete="off">${S.svc.q ? `<button class="tbtn" data-act="svcClearQ" aria-label="${esc(tx('Clear search'))}">${I.close}</button>` : ''}</label>
      <div class="dir" id="svcDir">${renderDir()}</div></section>
    <section class="card" style="flex:1;min-width:0;padding:18px 22px;display:flex;flex-direction:column;gap:14px" aria-label="${esc(tx('Service detail'))}">${svcPanel()}</section></main>`;
}

/* ---------- overlays ---------- */
function overlays() {
  let h = ''; const md = S.modal;
  if (md) {
    let inner = '';
    if (md.type === 'alarm') { const a = byId(md.id); if (a) inner = `<div class="dialog alarm" role="alertdialog" aria-modal="true" aria-label="${esc(tx('Alarm'))}"><div style="display:flex;align-items:center;gap:12px"><span class="sev alarm">!</span><span class="pill alarm">${tx('Alarm')}</span><span class="mono mut" style="font-size:14px">${esc(tx('Code {0} · {1}', a.def.code, tx(a.def.src)))}</span></div><h2 class="titlepic">${a.def.p ? pic(a.def.p, 'lg') : ''}${esc(tf(a.def.title))}</h2><p>${esc(tf(a.def.what))}</p><div><div class="kicker" style="margin-bottom:6px">${tx('Do this first')}</div><p style="font-size:20px;color:var(--txt)">${esc(tf(a.def.steps[0]))}</p></div><div class="acts"><button class="btn" data-act="mView" data-arg="${a.id}">${tx('See all steps')}</button><button class="btn pri" data-act="mAck" data-arg="${a.id}">${tx('Acknowledge')}</button></div></div>`; }
    else if (md.type === 'login') {
      const lv = md.sel;
      inner = `<div class="dialog wide" role="dialog" aria-modal="true" aria-label="${esc(tx('Access level'))}"><div class="card-h"><h2>${tx('Access level')}</h2><button class="tbtn" data-act="close" aria-label="${esc(tx('Close'))}">${I.close}</button></div>
        <p>${md.need ? esc(tx('This needs {0} level or higher.', lvlName(md.need))) : esc(tx('You are {0}. Pick a level and enter its code. You are logged out after 15 minutes.', lvlName(S.access)))}</p>
        <div class="lvlgrid">${LEVELS.map((L, i) => `<button class="lvl ${lv === i ? 'sel' : ''}" data-act="lvlSel" data-arg="${i}" ${md.need && i < md.need ? 'disabled style="opacity:.45"' : ''}><b>${tx(L.name)}</b><small>${tx(L.desc)}</small></button>`).join('')}</div>
        ${lv > 0 ? `<div style="display:flex;gap:20px;align-items:stretch"><div style="flex:1;display:flex;flex-direction:column;gap:10px;justify-content:center"><div class="entry ${md.err ? 'bad' : ''}" style="justify-content:center;align-items:center;gap:18px">${[0, 1, 2, 3].map((i) => `<span style="width:22px;height:22px;border-radius:11px;${i < md.code.length ? 'background:var(--txt)' : 'border:2px solid var(--line3)'}"></span>`).join('')}</div><div style="min-height:22px;font-size:16px;color:${md.err ? 'var(--redTxt)' : 'var(--mut)'}">${tx(md.err ? 'Wrong code. Try again. Demo codes are in the reviewer panel.' : 'Enter the 4 digit code, or use a login key.')}</div></div>
          <div class="keypad" style="width:330px">${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => `<button data-act="lkey" data-arg="${k}">${k}</button>`).join('')}<button data-act="lclr" style="font-size:18px">${tx('Clear|keypad')}</button><button data-act="lkey" data-arg="0">0</button><button data-act="ldel" aria-label="${esc(tx('Delete last digit'))}">⌫</button></div></div>` : ''}
        <div class="acts"><button class="btn" data-act="close">${tx('Cancel')}</button>${S.access ? `<button class="btn" data-act="logout">${tx('Log out')}</button>` : ''}<button class="btn pri" data-act="doLogin" ${lv > 0 && md.code.length < 4 ? 'disabled' : ''}>${tx(lv === 0 ? 'Use Operator level' : 'Log in')}</button></div></div>`;
    } else if (md.type === 'ind') {
      const all = INDS.map((i) => ({ ...i, st: i.s() })).sort((a, b) => (a.st ? SEVRANK[a.st] : 9) - (b.st ? SEVRANK[b.st] : 9));
      inner = `<div class="dialog wide" role="dialog" aria-modal="true" aria-label="${esc(tx('All indicators'))}" style="max-height:740px"><div class="card-h"><h2>${tx('All indicators')}</h2><button class="tbtn" data-act="close" aria-label="${esc(tx('Close'))}">${I.close}</button></div><p>${tx('Lit lamps first. Each one has a name, so nobody has to learn a symbol table.')}</p><div class="indgrid">${all.map((i) => `<div class="indcell ${i.st ? 'on-' + i.st : 'off'}">${i.p ? pic(i.p, 'lampic') : '<span class="lamp"></span>'}${esc(tx(i.l))}</div>`).join('')}</div><div class="acts"><button class="btn pri" data-act="close">${tx('Close')}</button></div></div>`;
    } else if (md.type === 'confirm') {
      const title = tx(md.title); const text = tx(md.text, ...(md.args || []));
      inner = `<div class="dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="acts"><button class="btn" data-act="close">${tx('Cancel')}</button><button class="btn ${md.danger ? 'danger' : 'pri'}" data-act="confirmOk">${esc(tx(md.ok))}</button></div></div>`;
    }
    if (inner) h += `<div class="overlay">${inner}</div>`;
  }
  if (S.cam) {
    const v = S.cam; const CAMN = { rear: K('Rear camera'), front: K('Front camera'), drum: K('Drum camera') }; const CAMS = { rear: K('Rear'), front: K('Front'), drum: K('Drum') };
    const lines = v === 'rear' ? '<i style="bottom:120px;background:#E0403A;left:150px;right:150px"></i><i style="bottom:260px;background:#F2A93B;left:220px;right:220px"></i><i style="bottom:380px;background:#4CC38A;left:280px;right:280px"></i>' : '';
    h += `<div class="cam" role="dialog" aria-label="${esc(tx('Camera view'))}"><div class="cam-view ${v === 'drum' ? 'boom' : v}"><div class="noise"></div><div class="rock" style="left:80px;top:120px;width:300px;height:220px"></div><div class="rock" style="right:120px;top:90px;width:340px;height:260px;background:#26251f"></div><div class="rock" style="left:420px;top:40px;width:420px;height:120px;background:#33312b"></div><div class="cam-guide">${lines}</div><span class="cam-tag">${tx(CAMN[v])} · ${tx('simulated')}</span><span class="cam-rec" data-live="clock"></span></div>
      <div class="cam-bar"><div class="tabs" style="flex:1;background:#15181C;border-color:#262C34">${['rear', 'front', 'drum'].map((k) => `<button class="${v === k ? 'on' : ''}" data-act="camera" data-arg="${k}" style="${v === k ? 'background:#E8EAED;color:#121417' : 'color:#B4BCC6'}">${tx(CAMS[k])}</button>`).join('')}</div><button class="btn pri" data-act="camClose" style="background:#E8EAED;color:#121417;border-color:#E8EAED;min-width:220px">${I.close}${tx('Close camera')}</button></div></div>`;
  }
  if (S.toast) h += `<div class="toast" role="status">${S.toast.kind === 'warn' ? `<span style="color:var(--amber)">${I.warn}</span>` : `<span style="color:var(--ok)">${I.check}</span>`}${esc(toastText())}</div>`;
  if (S.boot) { const st = bootStep(); const steps = [K('Checking modules on the bus'), K('Sending parameters to modules'), K('Modules operational')];
    h += `<div class="boot" role="status"><h2>${tx(S.boot.kind === 'update' ? 'Restarting after update' : 'Starting control system')}</h2><div class="steps">${steps.map((s, i) => `<div class="step ${i < st ? 'done' : i === st ? 'now' : ''}">${i < st ? `<span style="width:22px;height:22px;color:#8FD3C7">${I.check}</span>` : i === st ? '<span class="spin"></span>' : '<span style="width:22px"></span>'}${tx(s)}</div>`).join('')}</div><div class="progress"><div data-w="boot"></div></div><button class="btn" data-act="bootSkip" style="color:#E8EAED;border-color:#3A424C">${tx('Skip')}</button></div>`; }
  h += `<div class="dimmer" style="opacity:${((100 - S.bright) / 100 * 0.75).toFixed(2)}"></div>`;
  return h;
}
const bootStep = () => { const e = now() - S.boot.t0; return e < 1400 ? 0 : e < 2800 ? 1 : e < 3800 ? 2 : 3; };

/* ================= render + live ================= */
const screenEl = $('#screen');
const SCR = { drive: scrDrive, exhaust: scrExhaust, alerts: scrAlerts, mixer: scrMixer, engine: scrEngine, service: scrService };
let lastSig = '';
function render() {
  const focusSearch = document.activeElement && document.activeElement.id === 'svcSearch';
  const selStart = focusSearch ? document.activeElement.selectionStart : 0;
  screenEl.className = 'screen' + (S.theme === 'day' ? ' day' : '');
  screenEl.setAttribute('lang', S.lang);
  screenEl.innerHTML = topbar() + `<div class="body">${rail()}${SCR[S.screen]()}</div>` + overlays();
  if (focusSearch) { const i = $('#svcSearch'); if (i) { i.focus(); i.setSelectionRange(selStart, selStart); } }
  lastSig = sig(); live(); syncPanel();
}
const BLINKY = new Set(['LEFT_SIGNAL', 'RIGHT_SIGNAL', 'REAR_RIGHT_SIGNAL_TO_MRS', 'REAR_LEFT_SIGNAL_TO_MRS']);
const BIT_SIGS = Object.keys(SIG).filter((n) => SIG[n].s.len === 1 && !BLINKY.has(n));
function sig() {
  const bits = BIT_SIGS.map((n) => { const v = B(n); return v == null ? '-' : v ? '1' : '0'; }).join('');
  const gs = gearState();
  return [S.lang, S.screen, bits, gs ? gs.dir + gs.g : '-', DB.messages.map((x) => (fresh(x.id) ? 1 : 0)).join(''),
    S.alerts.map((a) => a.id + (a.active ? 'a' : 'c') + (a.acked ? 'k' : '')).join(','),
    dpfBand(), GAUGES.map(gState).join(), BRAKES.map(brakeState).join(), valveRows().map((r) => r.st).join(), dtcList().map((d) => d.spn + '.' + d.fmi).join(),
    S.regen.running, S.regen.done, regenChecks().map((c) => c.ok).join(), S.bt.phase, btChecks().map((c) => c.ok).join(), dischargeChecks().map((c) => c.ok).join(),
    S.svc.usb && S.svc.usb.phase, S.boot && bootStep(), S.toast && S.toast.until, S.access, S.m.exhaustT > 450, S.m.block,
    Object.keys(S.outputs).join(), S.modal && S.modal.type, moving(2), moving(0), S.m._starting, S.m._stopping].join('|');
}
const sensorV = () => { const c = S.svc.calib; const tgt = c && c.step < 3 ? (c.kind === 'lever' ? [12, 503, 996] : [8, 126, 248])[c.step] : 0; return Math.round(tgt + 3 * Math.sin(now() / 430)); };
function liveText(k) {
  const m = S.m;
  if (k.startsWith('g:')) { const g = GAUGES.find((x) => x.k === k.slice(2)); return g.d ? f1(g.get()) : f0(g.get()); }
  if (k.startsWith('g2:') || k.startsWith('c:')) return f0(C(k.slice(k.indexOf(':') + 1)));
  if (k.startsWith('lv:')) return f0(V(k.slice(3)));
  if (k.startsWith('raw:')) { const r = RAW(k.slice(4)); return r == null ? NA : String(r); }
  if (k.startsWith('val:')) { const n = k.slice(4); const v = C(n); if (v == null) return NA; const e = SIG[n].s; return e.len === 1 ? String(v) : (e.factor % 1 ? dec(v.toFixed(2)) : String(Math.round(v))); }
  if (k.startsWith('hex:')) { const f = BUS.frames[+k.slice(4)]; return f ? Array.from(f.data).map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ') : '-- -- -- -- -- -- -- --'; }
  if (k.startsWith('age:')) { const f = BUS.frames[+k.slice(4)]; if (!f) return tx('never'); const a = now() - f.t; return a > 9999 ? '>10 ' + tu('s') : a + ' ms'; }
  switch (k) {
    case 'clock': return hhmm(now());
    case 'sub': return SUBTITLE[S.screen]();
    case 'speed': return f0(G.speed());
    case 'gear': { const gs = gearState(); if (!gs) return NA; return gs.dir === 'N' ? tx('Neutral') : gs.g ? tx('Gear {0}', gs.dir + gs.g) : gs.dir; }
    case 'gearCode': { const gs = gearState(); return gs ? (gs.g ? gs.dir + gs.g : gs.dir) : NA; }
    case 'rpm': return f0(G.rpm());
    case 'pedal': return f0(G.pedal());
    case 'drumCoil': { const a = C('MIXER_RIGHT_COIL_CURRENT_MA'); const b = C('MIXER_RIGHT_COIL_CURRENT_MA_2'); return a == null ? NA : f0(Math.max(a, b || 0)); }
    case 'soot': return f0(m.soot);
    case 'odo': { const [i, d] = (Math.round(m.odo * 10) / 10).toFixed(1).split('.'); return f0(+i) + (S.lang === 'tr' ? ',' : '.') + d; }
    case 'trip': return f1(m.trip);
    case 'hours': return f0(G.hours() == null ? null : Math.floor(G.hours()));
    case 'battery': return f1(G.battery());
    case 'boost': return f2(G.boost());
    case 'boostT': return f0(G.boostT());
    case 'oilKpa': return f0(C('ENGINE_OIL_PRESSURE'));
    case 'fuelP': return f0(G.fuelP());
    case 'exhaustT': return f0(m.exhaustT);
    case 'btT': return f1(S.bt.t);
    case 'btDist': return f0(S.bt.dist);
    case 'usbT': return S.svc.usb ? String(Math.ceil(S.svc.usb.t)) : '';
    case 'sensor': return String(sensorV());
    default: return '';
  }
}
function liveWidth(k) {
  if (k.startsWith('g:')) { const g = GAUGES.find((x) => x.k === k.slice(2)); const v = g.get(); return v == null ? 0 : gPct(g, v); }
  if (k.startsWith('b:')) { const v = C(k.slice(2)); return v == null ? 0 : clamp(v / 200 * 100, 0, 100); }
  if (k.startsWith('lv:')) { const v = V(k.slice(3)); return v == null ? 0 : clamp(v, 0, 100); }
  switch (k) {
    case 'rpm': { const v = G.rpm(); return v == null ? 0 : clamp(v / 2600 * 100, 0, 100); }
    case 'soot': return clamp(S.m.soot, 0, 100);
    case 'regen': return S.regen.from > 6 ? clamp((S.regen.from - S.m.soot) / (S.regen.from - 6) * 100, 0, 100) : 0;
    case 'bt': return clamp(S.bt.t / 5 * 100, 0, 100);
    case 'usb': return S.svc.usb ? S.svc.usb.p * 100 : 0;
    case 'boot': return S.boot ? clamp((now() - S.boot.t0) / 4000 * 100, 0, 100) : 0;
    case 'sensor': { const c = S.svc.calib; const max = c && c.kind === 'pedal' ? 255 : 1000; return clamp(sensorV() / max * 100, 0, 100); }
    default: return 0;
  }
}
function live() {
  $$('[data-live]', screenEl).forEach((el) => { const v = liveText(el.dataset.live); if (el.textContent !== v) el.textContent = v; });
  $$('[data-w]', screenEl).forEach((el) => { el.style.width = liveWidth(el.dataset.w).toFixed(1) + '%'; });
  $$('[data-left]', screenEl).forEach((el) => { el.style.left = clamp(S.m.soot, 0, 100) + '%'; });
  $$('[data-points]', screenEl).forEach((el) => { const hst = S.m.hydHist; const n = hst.length; el.setAttribute('points', hst.map((v, i) => `${(430 - (n - 1 - i) * (430 / 59)).toFixed(1)},${(70 - clamp(v - 50, 0, 50) * 1.4).toFixed(1)}`).join(' ')); });
  $$('[data-sig]', screenEl).forEach((el) => { el.classList.toggle('on', el.dataset.sig === 'L' ? one('LEFT_SIGNAL') : one('RIGHT_SIGNAL')); });
  $$('.canrow', screenEl).forEach((el) => el.classList.toggle('stale', !fresh(+el.dataset.arg)));
}

/* ================= actions ================= */
function setLang(l) {
  S.lang = l;
  try { localStorage.setItem('hmi-lang', l); } catch (e) { /* ignore */ }
  try { const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u); } catch (e) { /* ignore */ }
  applyStatic();
}
const ACT = {
  nav: (k) => { S.screen = k; S.cam = null; if (S.modal && S.modal.type !== 'alarm') S.modal = null; },
  indGo: (k) => { const i = INDS.find((x) => x.k === k); if (!i) return; if (i.diag) S.diag = i.diag; ACT.nav(i.go || 'drive'); },
  theme: (arg) => { S.theme = arg || (S.theme === 'night' ? 'day' : 'night'); },
  langToggle: () => { setLang(S.lang === 'en' ? 'tr' : 'en'); toast(['Language set to {0}.', S.lang === 'tr' ? 'Türkçe' : 'English']); },
  lang: (k) => { setLang(k); toast(['Language set to {0}.', k === 'tr' ? 'Türkçe' : 'English']); },
  tz: (d) => { S.tz = clamp(S.tz + +d, -12, 14); },
  camera: (v) => { S.cam = v || 'rear'; },
  camClose: () => { S.cam = null; },
  login: () => { S.modal = { type: 'login', sel: Math.max(S.access, 2), code: '', err: '', need: 0, then: null }; },
  logout: () => { S.access = 0; S.modal = null; toast(['Logged out. Operator level.']); },
  lvlSel: (i) => { S.modal.sel = +i; S.modal.code = ''; S.modal.err = ''; },
  lkey: (k) => { if (S.modal.code.length < 4) S.modal.code += k; S.modal.err = ''; },
  lclr: () => { S.modal.code = ''; S.modal.err = ''; },
  ldel: () => { S.modal.code = S.modal.code.slice(0, -1); },
  doLogin: () => {
    const md = S.modal; const L = LEVELS[md.sel];
    if (md.sel === 0) { S.access = 0; S.modal = null; toast(['Operator level.']); return; }
    if (md.code !== L.code) { md.err = 'wrong'; md.code = ''; return; }
    S.access = md.sel; S.accessUntil = now() + 15 * 60e3; S.modal = null; toast(['Logged in as {0}.', () => tx(L.name)]);
    if (md.then) dispatch(md.then[0], md.then[1]);
  },
  close: () => { closeModal(); },
  mAck: (id) => { const a = byId(id); if (a) a.acked = true; closeModal(); },
  mView: (id) => { const a = byId(id); S.screen = 'alerts'; S.alertTab = 'active'; S.alertSel = +id; if (a) a.acked = true; closeModal(); },
  confirmOk: () => { const md = S.modal; S.modal = null; if (md && md.then) dispatch(md.then); },
  indAll: () => { S.modal = { type: 'ind' }; },
  bootSkip: () => { S.boot = null; S.screen = 'drive'; },
  inhibit: () => { S.regen.inhibit = !S.regen.inhibit; },
  confirmArea: () => { S.regen.confirmed = !S.regen.confirmed; },
  regenStart: () => { S.regen.running = true; S.regen.done = false; S.regen.from = S.m.soot; toast(['Regeneration started. Stay with the machine.']); },
  regenStop: () => { S.regen.running = false; S.regen.confirmed = false; toast(['Regeneration stopped by operator.'], 'warn'); },
  regenDone: () => { S.regen.done = false; S.regen.confirmed = false; },
  aTab: (k) => { S.alertTab = k; S.alertSel = null; },
  aSel: (id) => { S.alertSel = +id; },
  ack: (id) => { const a = byId(id); if (a) a.acked = true; },
  ackAll: () => { S.alerts.forEach((a) => { if (a.active) a.acked = true; }); toast(['All active alerts acknowledged.']); },
  alertHistory: () => { S.screen = 'alerts'; S.alertTab = 'history'; S.alertSel = null; },
  saveAlertsUsb: () => { S.screen = 'service'; S.svc.panel = 'usb:alerts'; S.svc.usb = null; },
  clearHist: () => { if (!need(1, 'clearHist')) return; S.modal = { type: 'confirm', title: 'Clear alarm history?', text: 'This removes {0} cleared alerts from the log. Active alerts stay. Save to USB first if you need a copy.', args: [historyAlerts().length], ok: 'Clear history', danger: true, then: 'doClearHist' }; },
  doClearHist: () => { S.alerts = S.alerts.filter((a) => a.active); S.alertSel = null; toast(['Alarm history cleared.']); },
  diag: (k) => { S.diag = k; },
  diagGo: (k) => { S.screen = 'engine'; S.diag = k; S.cam = null; if (S.modal && S.modal.type !== 'alarm') S.modal = null; },
  canSel: (id) => { S.canSel = +id; },
  brakeTest: () => { S.screen = 'engine'; S.diag = 'brake'; S.cam = null; if (S.bt.phase !== 'running') S.bt = { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: false, saved: false }; },
  btArea: () => { S.bt.area = !S.bt.area; },
  btStart: () => { Object.assign(S.bt, { phase: 'running', t: 0, dist: 0, max1: 0, max2: 0, saved: false }); },
  btReset: () => { S.bt = { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: S.bt.area, saved: false }; },
  btSave: () => { S.bt.saved = true; S.reports.push({ t: now(), pass: S.bt.phase === 'pass' }); toast(['Brake test report saved to the machine log.']); },
  svcItem: (arg) => { const [gi, ii] = arg.split(':').map(Number); const it = DIR[gi].items[ii]; if ((it.lvl || 0) > S.access) { need(it.lvl, 'svcItem', arg); return; } if (it.act) { dispatch(it.act, it.arg); return; } ACT.svcOpen(it.p); },
  svcOpen: (p) => {
    const gate = { outputs: 2, 'usb:backup': 2, 'usb:update': 2, 'params:system': 3, defaults: 3, 'calib:lever': 2, 'calib:pedal': 2 }[p] || 0;
    if (gate > S.access) { need(gate, 'svcOpen', p); return; }
    S.screen = 'service'; S.svc.panel = p; S.svc.param = null; S.svc.mode = 'view'; S.svc.calib = null;
    if (p.startsWith('usb:')) S.svc.usb = null;
    if (p === 'params:system') S.svc.param = 'serial';
  },
  svcHome: () => { S.svc.panel = 'home'; S.svc.usb = null; S.svc.calib = null; },
  svcClearQ: () => { S.svc.q = ''; },
  pSel: (id) => { S.svc.param = id; S.svc.mode = 'view'; },
  pList: () => { S.svc.param = null; S.svc.mode = 'view'; },
  pEdit: () => { const f = findParam(S.svc.param); if (!need(f.p.level || 2, 'pEdit')) return; S.svc.mode = 'edit'; S.svc.entry = String(PV[f.p.id]); },
  key: (k) => { S.svc.entry = (S.svc.entry + k).replace(/^0+(?=\d)/, '').slice(0, 5); },
  keyClr: () => { S.svc.entry = ''; },
  keyDel: () => { S.svc.entry = S.svc.entry.slice(0, -1); },
  pCancel: () => { S.svc.mode = 'view'; },
  pReview: () => { S.svc.mode = 'review'; },
  pBack: () => { S.svc.mode = 'edit'; },
  pSave: () => { const f = findParam(S.svc.param); const n = parseInt(S.svc.entry, 10); const old = PV[f.p.id]; PV[f.p.id] = n; S.phist.push({ i: S.phist.length, t: now(), id: f.p.id, unit: f.p.unit, old, nw: n, by: S.access }); S.svc.mode = 'view'; toast(['{0} saved: {1} → {2} {3}.', () => tx(f.p.name), old, n, () => tu(f.p.unit)]); },
  undo: (i) => { const h = S.phist[+i]; if (!h || h.undone) return; const f = findParam(h.id); if (!need(f.p.level || 2, 'undo', i)) return; PV[h.id] = h.old; h.undone = true; S.phist.push({ i: S.phist.length, t: now(), id: h.id, unit: h.unit, old: h.nw, nw: h.old, by: S.access, undone: true, isUndo: true }); toast(['{0} restored to {1} {2}.', () => tx(f.p.name), h.old, () => tu(h.unit)]); },
  usbEstop: () => { S.svc.usb.estop = !S.svc.usb.estop; },
  usbInsert: () => { S.svc.usb.inserted = true; },
  usbStart: () => { const u = S.svc.usb; if (u.kind === 'update') { u.phase = 'countdown'; u.t = 10; } else { u.phase = 'working'; u.p = 0; } },
  usbCancel: () => { S.svc.usb = null; toast(['Update cancelled. Stick removed.'], 'warn'); },
  usbDone: () => { S.svc.usb = null; S.svc.panel = 'home'; },
  restart: () => { S.svc.usb = null; S.svc.panel = 'home'; S.boot = { t0: now(), kind: 'update' }; },
  calCap: () => { const c = S.svc.calib; c.cap[c.step] = sensorV(); c.step++; },
  calRedo: () => { S.svc.calib = { kind: S.svc.calib.kind, step: 0, cap: [] }; },
  calSave: () => { const k = S.svc.calib.kind; S.svc.calib = null; S.svc.panel = 'home'; toast([{ lever: 'Drum lever calibration saved.', pedal: 'Pedal calibration saved.' }[k]]); },
  outTest: (k) => { if (['mixUp', 'mixDown'].includes(k) && !S.m.parkBrake) { toast(['Apply the parking brake before testing coils.'], 'warn'); return; } S.outputs[k] = now() + 2000; },
  defaultsAsk: () => { S.modal = { type: 'confirm', title: 'Restore factory defaults?', text: 'Every engine and drivetrain parameter goes back to its factory value. Each change is logged and can be undone.', ok: 'Restore defaults', danger: true, then: 'doDefaults' }; },
  doDefaults: () => { let n = 0; Object.values(PARAMS).forEach((g) => g.items.forEach((p) => { if (p.id !== 'serial' && PV[p.id] !== p.def) { S.phist.push({ i: S.phist.length, t: now(), id: p.id, unit: p.unit, old: PV[p.id], nw: p.def, by: S.access }); PV[p.id] = p.def; n++; } })); toast(n ? [n > 1 ? '{0} parameters restored to factory values.' : '{0} parameter restored to factory values.', n] : ['Everything was already at factory values.']); },
};
function dispatch(name, arg) { if (ACT[name]) { ACT[name](arg); transmit(); render(); } }

screenEl.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (!el || el.disabled || !screenEl.contains(el)) return; dispatch(el.dataset.act, el.dataset.arg); });
screenEl.addEventListener('input', (e) => {
  if (e.target.id === 'svcSearch') { S.svc.q = e.target.value; const d = $('#svcDir'); if (d) d.innerHTML = renderDir(); }
  if (e.target.dataset.input === 'bright') { S.bright = +e.target.value; const dm = $('.dimmer', screenEl); if (dm) dm.style.opacity = ((100 - S.bright) / 100 * 0.75).toFixed(2); const k = $('#brightLbl'); if (k) k.textContent = tx('Brightness · {0}', pct(S.bright)); }
});
let holdTimer = null;
screenEl.addEventListener('pointerdown', (e) => { const el = e.target.closest('[data-hold]'); if (!el) return; el.classList.add('holding'); holdTimer = setTimeout(() => { el.classList.remove('holding'); if (el.dataset.hold === 'resetTrip') { S.m.trip = 0; toast(['Trip reset to {0} km.', () => f1(0)]); render(); } }, 2000); });
const cancelHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } $$('.holding', screenEl).forEach((x) => x.classList.remove('holding')); };
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => screenEl.addEventListener(ev, cancelHold));
screenEl.addEventListener('keydown', (e) => { const el = e.target.closest && e.target.closest('[data-hold]'); if (el && (e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } });
screenEl.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') cancelHold(); });

/* ================= static page text + reviewer panel ================= */
function applyStatic() {
  document.documentElement.lang = S.lang;
  $$('[data-i18n]').forEach((el) => { el.textContent = tx(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = tx(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', tx(el.dataset.i18nAria)); });
  screenEl.setAttribute('aria-label', tx('Machine display, 1280 by 800'));
  const pnl = $('.panel'); if (pnl) pnl.setAttribute('aria-label', tx('Reviewer controls'));
  const rl = $('#rationaleLink'); if (rl) rl.href = 'rationale.html?lang=' + S.lang;
  document.title = tx('NorSmart HMI Concept');
  renderScenarios();
}
const scenEl = $('#scenarios');
function renderScenarios() { scenEl.innerHTML = SCEN.map((s) => `<button class="pbtn" data-scen="${s.k}">${esc(tf(s.t))}<small>${esc(tf(s.d))}</small></button>`).join(''); }
scenEl.addEventListener('click', (e) => { const b = e.target.closest('[data-scen]'); if (!b) return; SCEN.find((s) => s.k === b.dataset.scen).f(); $('#pThrottle').value = Math.round(S.m.throttle * 100); transmit(); evalAlerts(); render(); });
function engineButton() {
  const m = S.m;
  if (m.engineOn && !m._stopping) { const d = P('coolDown'); if (d > 0) { m._stopping = true; m.delay = d; toast(['Engine cool-down. Stops in {0} s.', d]); } else { m.engineOn = false; toast(['Engine stopped.']); } return; }
  if (m.engineOn || m._starting) return;
  m.ign = true;
  if (m.dir !== 'N') { m.neutralNeeded = 4; toast(['Put the drive lever in N to start the engine.'], 'warn'); return; }
  if (m.coolant < 40) { m._starting = 'preheat'; m.preheat = 3; } else { m._starting = 'crank'; m.crank = 1.2; }
}
$('.panel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  const m = S.m; const p = b.dataset.p; const v = b.dataset.v;
  if (p === 'ign') { if (m.engineOn) toast(['Stop the engine first.'], 'warn'); else m.ign = !m.ign; }
  if (p === 'engine') engineButton();
  if (p === 'dir') { m.dir = v; if (v === 'N') m.neutralNeeded = 0; }
  if (p === 'park') m.parkBrake = !m.parkBrake;
  if (p === 'pedal') m.pedal = !m.pedal;
  if (p === 'drum') m.drumCmd = +v;
  if (p === 'drumLock') m.drumLock = !m.drumLock;
  if (p === 'ctrl') m.ctrlRear = v === 'rear';
  if (p === 'mix') { if (v === 'up') m.mixUp = 1.5; else m.mixDown = 1.5; }
  if (p === 'half') { if (v === 'up') { m.halfUp = 0.6; m.rearAdd = clamp(m.rearAdd + P('halfStep'), 0, 1200); } else { m.halfDown = 0.6; m.rearAdd = clamp(m.rearAdd - P('halfStep'), 0, 1200); } }
  if (p === 'door') { if (v === 'L') m.doorL = !m.doorL; else m.doorR = !m.doorR; }
  if (p === 'belt') m.belt = !m.belt;
  if (p === 'steer') m.steerLock = !m.steerLock;
  if (p === 'signal') { if (v === 'L') { m.sigL = !m.sigL; m.sigR = false; } else if (v === 'R') { m.sigR = !m.sigR; m.sigL = false; } else m.hazard = !m.hazard; }
  if (p === 'light') { if (v === 'head') m.headlight = !m.headlight; else if (v === 'work') m.workF = !m.workF; else if (v === 'horn') m.horn = 1; }
  if (p === 'can') { if (v === 'all') BUS.dropAll = !BUS.dropAll; else BUS.mrsOff = !BUS.mrsOff; }
  if (p === 'test') ACT.brakeTest();
  if (p === 'camera') S.cam = S.cam ? null : 'rear';
  if (p === 'reboot') S.boot = { t0: now(), kind: 'start' };
  transmit(); render();
});
$('#pThrottle').addEventListener('input', (e) => { S.m.throttle = +e.target.value / 100; $('#pThrottleV').textContent = pct(e.target.value).replace(' ', ''); });
function syncPanel() {
  const m = S.m;
  const set = (id, txt, on) => { const el = $('#' + id); if (!el) return; if (txt != null && el.textContent !== txt) el.textContent = txt; el.classList.toggle('on', !!on); };
  set('pIgn', tx(m.ign ? 'On|ignition' : 'Off|ignition'), m.ign);
  set('pEngine', tx(m._starting ? 'Starting…' : m._stopping ? 'Cool-down…' : m.engineOn ? 'Running · tap to stop' : 'Stopped · tap to start'), m.engineOn);
  set('pPark', tx(m.parkBrake ? 'Applied|park' : 'Released|park'), m.parkBrake);
  set('pPedal', tx(m.pedal ? 'Pressed' : 'Released|pedal'), m.pedal);
  set('pLock', tx(m.drumLock ? 'Locked' : 'Unlocked'), m.drumLock);
  set('pBelt', tx(m.belt ? 'Fastened' : 'Not fastened'), !m.belt);
  set('pSteer', tx(m.steerLock ? 'Locked' : 'Unlocked'), m.steerLock);
  set('pCanAll', null, BUS.dropAll); set('pCanMrs', null, BUS.mrsOff);
  set('pDoorL', null, m.doorL); set('pDoorR', null, m.doorR);
  set('pSigL', null, m.sigL); set('pSigR', null, m.sigR); set('pHaz', null, m.hazard);
  set('pHead', null, m.headlight); set('pWork', null, m.workF);
  $$('#pDir button').forEach((b) => b.classList.toggle('on', b.dataset.v === m.dir));
  $$('#pDrum button').forEach((b) => b.classList.toggle('on', +b.dataset.v === m.drumCmd));
  $$('#pCtrl button').forEach((b) => b.classList.toggle('on', (b.dataset.v === 'rear') === m.ctrlRear));
  $('#pThrottleV').textContent = pct(Math.round(m.throttle * 100)).replace(' ', '');
}
const notes = $('#notes');
try { notes.value = localStorage.getItem('hmi-notes') || ''; } catch (e) { /* storage blocked */ }
notes.addEventListener('input', () => { try { localStorage.setItem('hmi-notes', notes.value); } catch (e) { /* ignore */ } });
$('#copyNotes').addEventListener('click', async () => { const msg = $('#copyMsg'); try { await navigator.clipboard.writeText(notes.value); msg.textContent = tx('Copied.'); } catch (e) { notes.select(); msg.textContent = tx('Press Ctrl+C or Cmd+C to copy.'); } setTimeout(() => { msg.textContent = ''; }, 2500); });

/* ================= scaling ================= */
const wrap = $('#deviceWrap'); const dev = $('#device');
function fit() {
  const stage = wrap.parentElement; const W = 1280 + 44, H = 800 + 44;
  const narrow = window.innerWidth <= 1100;
  const availH = narrow ? Infinity : window.innerHeight - (wrap.getBoundingClientRect().top + window.scrollY) - 50;
  const k = Math.max(0.25, Math.min(stage.clientWidth / W, Math.max(availH, 420) / H, 1.25));
  dev.style.transform = `scale(${k})`; wrap.style.width = W * k + 'px'; wrap.style.height = H * k + 'px';
}
window.addEventListener('resize', fit);

/* ================= start ================= */
seedHistory();
S.boot = { t0: now(), kind: 'start' };
transmit();
applyStatic(); render(); fit(); setTimeout(fit, 300);
setInterval(() => {
  const tNow = now(); const dt = Math.min(0.5, (tNow - last) / 1000); last = tNow;
  sim(dt); evalAlerts();
  if (sig() !== lastSig) render(); else live();
}, 250);
window.__hmi = { setLang, S, tx, BUS, C, RAW, SIG, ACT: (n, a) => dispatch(n, a) };
})();
