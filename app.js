/* NorSmart 3 Stage V HMI redesign concept — interactive prototype (English / Turkish).
   Everything here is simulated. No real machine parameters. */
(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, t, rate, dt) => { const d = t - v; const s = rate * dt; return Math.abs(d) <= s ? t : v + Math.sign(d) * s; };
const now = () => Date.now();

/* ---------- i18n ---------- */
const DICT = window.HMI_TR || {};
const MISSING = new Set();
window.__trMissing = MISSING;
const K = (s) => s; // marks a translation key stored in data
function tx(s, ...a) {
  let o;
  if (S.lang === 'tr') { o = DICT[s]; if (o == null) { MISSING.add(s); o = s.split('|')[0]; } } else o = s.split('|')[0];
  a.forEach((v, i) => { o = o.split('{' + i + '}').join(String(v)); });
  return o;
}
const tf = (x) => (typeof x === 'function' ? x(S.m) : tx(x));
const UNIT_TR = { 'km/h': 'km/sa', rpm: 'd/dk', h: 'sa', 'l/h': 'l/sa', s: 'sn', min: 'dk' };
const tu = (u) => (S.lang === 'tr' && UNIT_TR[u] ? UNIT_TR[u] : u);
const f0 = (v) => Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');
const dec = (s) => (S.lang === 'tr' ? String(s).replace('.', ',') : String(s));
const f1 = (v) => dec((Math.round(v * 10) / 10).toFixed(1));
const pct = (n) => (S.lang === 'tr' ? '%' + n : n + ' %');
const hhmm = (t) => { const d = new Date(t + S.tz * 3600e3); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const ago = (t) => { const s = Math.round((now() - t) / 1000); if (s < 45) return tx('just now'); const m = Math.round(s / 60); if (m < 60) return tx('{0} min ago', m); return tx('{0} h ago', Math.round(m / 60)); };
const dur = (ms) => { const s = Math.round(ms / 1000); if (s < 60) return s + ' ' + tu('s'); const m = Math.round(s / 60); if (m < 60) return m + ' ' + tu('min'); return Math.round(m / 60) + ' ' + tu('h'); };

const sv = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  drive: sv('<path d="M3.5 18a9 9 0 1 1 17 0"/><path d="M12 14l4.5-4.5"/><circle cx="12" cy="14" r="1.2"/>'),
  exhaust: sv('<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>'),
  alerts: sv('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/>', 2.2),
  warn: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/>', 2.4),
  machine: sv('<rect x="3" y="6" width="18" height="9" rx="1.5"/><path d="M6 15v5M18 15v5M4 20h4M16 20h4"/>'),
  engine: sv('<path d="M4 10h3l2-3h6l2 3h3v7h-3l-2 2H9l-2-2H4z"/><path d="M12 10v4"/>'),
  service: sv('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  key: sv('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M17 6l3 3"/>'),
  sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  camera: sv('<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>'),
  globe: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>'),
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
    { id: 'highIdle', name: K('High idle during regeneration'), unit: 'rpm', min: 1200, max: 1600, def: 1400 },
    { id: 'maxRpm', name: K('Maximum engine speed'), unit: 'rpm', min: 1800, max: 2400, def: 2200 },
  ] },
  hydro: { title: K('Hydrostatic drive'), items: [
    { id: 'pumpFwd', name: K('Drive pump max current, forward'), unit: 'mA', min: 400, max: 800, def: 600 },
    { id: 'pumpRev', name: K('Drive pump max current, reverse'), unit: 'mA', min: 400, max: 800, def: 600 },
    { id: 'ramp', name: K('Slow gear deceleration ramp'), unit: 'ms', min: 200, max: 3000, def: 1200 },
  ] },
  gears: { title: K('Automatic gears'), items: [
    { id: 'maxF', name: K('Maximum gear, forward'), unit: '', min: 1, max: 3, def: 3 },
    { id: 'maxR', name: K('Maximum gear, reverse'), unit: '', min: 1, max: 3, def: 2 },
    { id: 'shiftDelay', name: K('Shift delay after new gear'), unit: 'ms', min: 100, max: 1500, def: 400 },
  ] },
  retarder: { title: K('Retarder'), items: [
    { id: 'retStrength', name: K('Retarder strength'), unit: '%', min: 0, max: 100, def: 60 },
    { id: 'retStart', name: K('Retarder start speed'), unit: 'km/h', min: 2, max: 15, def: 5 },
  ] },
  susp: { title: K('Suspension'), items: [
    { id: 'suspLevel', name: K('Ride height set point'), unit: 'mm', min: 0, max: 120, def: 60 },
    { id: 'suspDamp', name: K('Damping'), unit: '%', min: 0, max: 100, def: 50 },
  ] },
  system: { title: K('Machine identity'), items: [
    { id: 'serial', name: K('Machine serial number'), unit: '', min: 10000, max: 99999, def: 10000, level: 3 },
  ] },
};
const PV = {};
Object.values(PARAMS).forEach((g) => g.items.forEach((p) => { PV[p.id] = p.def; }));
PV.pumpFwd = 620; PV.serial = 24117;
const P = (id) => PV[id];
const findParam = (id) => { for (const [gk, g] of Object.entries(PARAMS)) { const p = g.items.find((x) => x.id === id); if (p) return { p, gk, g }; } return null; };
const withUnit = (v, u) => (u === '%' ? pct(v) : u ? v + ' ' + tu(u) : String(v));

/* ================= state ================= */
const S = {
  screen: 'drive', theme: 'night', bright: 100, lang: 'en', tz: 0,
  access: 0, accessUntil: 0,
  m: {
    engineOn: true, dir: 'F', throttle: 0.35, parkBrake: false, pedal: false, estop: false,
    speed: 12, rpm: 1500, gear: 2, odo: 4812.6, trip: 18.4, hours: 2931.2,
    coolant: 86, trans: 78, hyd: 64, hydTarget: 64, fuel: 62, def: 48, soot: 64, ash: 18,
    exhaustT: 300, brake1: 0, brake2: 0, acc: 172, parkP: 138, battery: 27.6, ambient: 18,
    insulation: 2000, legs: [false, false, false, false], block: null, hydHist: [],
  },
  legMove: [null, null, null, null],
  regen: { inhibit: true, confirmed: false, running: false, done: false, from: 0, count: 142 },
  alerts: [], seq: 0, alertTab: 'active', alertSel: null,
  legSel: 3,
  modal: null, modalQueue: [], toast: null,
  cam: null, boot: null,
  diag: 'engine', net: { phase: 'idle', p: 0, sel: 'mid' },
  bt: { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: false, saved: false },
  svc: { q: '', panel: 'home', param: null, mode: 'view', entry: '', calib: null, usb: null },
  phist: [], outputs: {}, reports: [],
};
(() => {
  let l = null;
  try { l = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
  if (!l) { try { l = localStorage.getItem('hmi-lang'); } catch (e) { /* ignore */ } }
  if (l === 'tr' || l === 'en') S.lang = l;
})();

/* ================= gauges ================= */
const GAUGES = [
  { k: 'fuel', label: K('Fuel'), unit: '%', min: 0, max: 100, v: (m) => m.fuel, low: true, warn: 12, alarm: 5 },
  { k: 'def', label: K('DEF (AdBlue)'), unit: '%', min: 0, max: 100, v: (m) => m.def, low: true, warn: 15, alarm: 5 },
  { k: 'coolant', label: K('Engine coolant'), unit: '°C', min: 40, max: 120, v: (m) => m.coolant, warn: 100, alarm: 105 },
  { k: 'trans', label: K('Transmission oil'), unit: '°C', min: 40, max: 130, v: (m) => m.trans, warn: 105, alarm: 115 },
  { k: 'hyd', label: K('Hydraulic oil'), unit: '°C', min: 20, max: 110, v: (m) => m.hyd, warn: 85, alarm: 90 },
  { k: 'acc', label: K('Brake accumulator'), unit: 'bar', min: 0, max: 200, v: (m) => m.acc, low: true, warn: 130, alarm: 115 },
  { k: 'b1', label: K('Brake circuit 1'), unit: 'bar', min: 0, max: 160, v: (m) => m.brake1 },
  { k: 'b2', label: K('Brake circuit 2'), unit: 'bar', min: 0, max: 160, v: (m) => m.brake2 },
  { k: 'parkP', label: K('Park brake release'), unit: 'bar', min: 0, max: 200, v: (m) => m.parkP },
];
const gPct = (g, v) => clamp((v - g.min) / (g.max - g.min) * 100, 0, 100);
const gState = (g) => {
  if (g.warn == null) return 'ok';
  const v = g.v(S.m);
  if (g.low) return v <= g.alarm ? 'alarm' : v <= g.warn ? 'warn' : 'ok';
  return v >= g.alarm ? 'alarm' : v >= g.warn ? 'warn' : 'ok';
};

/* ================= indicators ================= */
const INDS = [
  { k: 'estop', l: K('Emergency stop'), s: (m) => (m.estop ? 'alarm' : null), go: 'alerts' },
  { k: 'alarms', l: K('Active alarms'), s: () => (S.alerts.some((a) => a.active && a.sev === 'alarm') ? 'alarm' : null), go: 'alerts' },
  { k: 'hyd', l: K('Hydraulic oil hot'), s: (m) => (m.hyd > 90 ? 'alarm' : m.hyd > 85 ? 'warn' : null), go: 'alerts' },
  { k: 'stopEng', l: K('Stop engine'), s: (m) => (m.soot >= 80 ? 'alarm' : null), go: 'exhaust' },
  { k: 'checkEng', l: K('Check engine'), s: (m) => (m.soot >= 70 ? 'warn' : null), go: 'engine' },
  { k: 'dpf', l: K('Regenerate DPF when parked'), s: (m) => (m.soot >= 80 ? 'alarm' : m.soot > 60 ? 'warn' : null), go: 'exhaust' },
  { k: 'iso', l: K('Earth leak'), s: (m) => (m.insulation < 100 ? 'alarm' : m.insulation < 500 ? 'warn' : null), go: 'alerts' },
  { k: 'fuel', l: K('Fuel low'), s: (m) => (m.fuel < 5 ? 'alarm' : m.fuel < 12 ? 'warn' : null), go: 'drive' },
  { k: 'svcBrake', l: K('Brake accumulator low'), s: (m) => (m.acc < 115 ? 'alarm' : null), go: 'drive' },
  { k: 'hest', l: K('High exhaust temperature'), s: (m) => (m.exhaustT > 450 ? 'warn' : null), go: 'exhaust' },
  { k: 'blocked', l: K('Drive blocked'), s: (m) => (m.block ? 'warn' : null), go: 'alerts' },
  { k: 'def', l: K('DEF low'), s: (m) => (m.def < 15 ? 'warn' : null), go: 'exhaust' },
  { k: 'battery', l: K('Battery not charging'), s: (m) => (m.engineOn && m.battery < 25 ? 'warn' : null), go: 'engine' },
  { k: 'inhibit', l: K('Regeneration inhibited'), s: () => (S.regen.inhibit ? 'info' : null), go: 'exhaust' },
  { k: 'park', l: K('Parking brake on'), s: (m) => (m.parkBrake ? 'info' : null), go: 'machine' },
  { k: 'pedal', l: K('Brake pedal pressed'), s: (m) => (m.pedal ? 'info' : null), go: 'engine' },
  { k: 'legs', l: K('Support legs down'), s: (m) => (m.legs.some(Boolean) ? 'info' : null), go: 'machine' },
  { k: 'ops', l: K('Operator present'), s: () => 'info', go: 'machine' },
  { k: 'wheels', l: K('Wheels straight F / R'), s: () => 'info', go: 'machine' },
  { k: 'beam', l: K('High beam'), s: (m) => (m.engineOn ? 'info' : null), go: 'drive' },
  { k: 'water', l: K('Water in fuel'), s: () => null }, { k: 'transP', l: K('Transmission oil pressure'), s: () => null },
  { k: 'hydLvl', l: K('Hydraulic oil level'), s: () => null }, { k: 'retFilter', l: K('Return filter blocked'), s: () => null },
  { k: 'airFilter', l: K('Air filter blocked'), s: () => null }, { k: 'axle', l: K('Axle temperature'), s: () => null },
  { k: 'oilT', l: K('Engine oil temperature'), s: () => null }, { k: 'oilP', l: K('Engine oil pressure'), s: () => null },
  { k: 'boom', l: K('Boom out of transport'), s: () => null }, { k: 'doors', l: K('Cab door open'), s: () => null },
];
const SEVRANK = { alarm: 0, warn: 1, info: 2 };
const activeInds = () => INDS.map((i) => ({ ...i, st: i.s(S.m) })).filter((i) => i.st).sort((a, b) => SEVRANK[a.st] - SEVRANK[b.st]);
const SEVNAME = { alarm: K('Alarm'), warn: K('Warning'), info: K('Info') };

/* ================= alerts ================= */
const AD = [
  { key: 'estop', code: 'E-STOP', sev: 'alarm', src: K('Safety circuit'), c: (m) => m.estop,
    title: K('Emergency stop pressed'), sub: K('Drive, boom and engine outputs cut'),
    what: K('An emergency stop button is pressed.'), effect: K('Nothing on the machine can move until it is released.'),
    steps: [K('Make sure the area is safe.'), K('Release the emergency stop button that was pressed.'), K('Restart the engine if it stopped.')] },
  { key: 'hyd2', code: '4131', sev: 'alarm', src: K('Work hydraulics'), c: (m) => m.hyd > 90,
    title: K('Hydraulic oil critically hot'), sub: (m) => tx('{0} °C, alarm limit 90 °C', f1(m.hyd)),
    what: (m) => tx('Work hydraulic oil is at {0} °C. The alarm limit is 90 °C.', f1(m.hyd)), effect: K('Boom and hammer speed are limited to protect seals and pumps.'),
    steps: [K('Stop scaling and park the boom.'), K('Leave the power pack running so the cooler can work.'), K('Check the oil cooler for dust or blockage.'), K('If it stays above 85 °C for 10 min, call maintenance.')], trend: true, link: ['drive', K('See gauge on Drive')] },
  { key: 'hyd1', code: '4130', sev: 'warn', src: K('Work hydraulics'), c: (m) => m.hyd > 85 && m.hyd <= 90,
    title: K('Hydraulic oil hot'), sub: (m) => tx('{0} °C, warning limit 85 °C', f1(m.hyd)),
    what: (m) => tx('Work hydraulic oil is at {0} °C and rising.', f1(m.hyd)), effect: K('None yet. Above 90 °C boom speed is limited.'),
    steps: [K('Ease off the hammer.'), K('Check the oil cooler for dust or blockage.')], trend: true, link: ['drive', K('See gauge on Drive')] },
  { key: 'dpf6', code: 'DPF-L6', sev: 'alarm', src: K('Engine aftertreatment'), c: (m) => m.soot >= 80,
    title: K('Exhaust filter overloaded'), sub: (m) => tx('Soot {0} · level {1}', pct(f0(m.soot)), 6),
    what: K('The particulate filter is too full for a standstill regeneration.'), effect: K('Engine torque and speed are derated.'),
    steps: [K('Park the machine safely.'), K('Call the workshop. A service tool is needed.')], link: ['exhaust', K('Open Exhaust')] },
  { key: 'dpf5', code: 'DPF-L5', sev: 'warn', src: K('Engine aftertreatment'), c: (m) => m.soot >= 70 && m.soot < 80,
    title: K('Regenerate exhaust filter now'), sub: (m) => tx('Soot {0} · level {1}', pct(f0(m.soot)), 5),
    what: (m) => tx('Soot load in the particulate filter is {0}.', pct(f0(m.soot))), effect: K('At 80 % soot the engine is derated and a service tool is needed.'),
    steps: [K('Stop work and park safely.'), K('Run a standstill regeneration from the Exhaust screen.')], link: ['exhaust', K('Open Exhaust')] },
  { key: 'dpf4', code: 'DPF-L4', sev: 'warn', src: K('Engine aftertreatment'), c: (m) => m.soot > 60 && m.soot < 70,
    title: K('Exhaust filter needs regeneration'), sub: (m) => tx('Soot {0} · level {1}', pct(f0(m.soot)), 4),
    what: (m) => tx('Soot load in the particulate filter is {0}.', pct(f0(m.soot))), effect: K('None yet. At 80 % soot the engine is derated.'),
    steps: [K('Finish the current task and park safely.'), K('Open Exhaust and follow the standstill regeneration checks.')], link: ['exhaust', K('Open Exhaust')] },
  { key: 'inh', code: 'INH', sev: 'info', src: K('Engine aftertreatment'), c: (m) => S.regen.inhibit && m.soot > 60,
    title: K('Regeneration is inhibited'), sub: K('Inhibit switch on'),
    what: K('The inhibit switch blocks automatic and standstill regeneration.'), effect: K('Soot keeps building until the switch is set to Permit.'),
    steps: [K('Set the switch to Permit when the machine is somewhere safe to regenerate.')], link: ['exhaust', K('Open Exhaust')] },
  { key: 'fuel2', code: '4204', sev: 'alarm', src: K('Fuel system'), c: (m) => m.fuel < 5,
    title: K('Fuel critically low'), sub: (m) => tx('{0} left', pct(f0(m.fuel))),
    what: K('The fuel tank is almost empty.'), effect: K('The engine will stop soon. Running dry means the fuel system must be bled.'),
    steps: [K('Stop work now.'), K('Refuel before restarting.')], link: ['drive', K('See gauge on Drive')] },
  { key: 'fuel1', code: '4203', sev: 'warn', src: K('Fuel system'), c: (m) => m.fuel < 12 && m.fuel >= 5,
    title: K('Fuel low'), sub: (m) => tx('{0} left', pct(f0(m.fuel))),
    what: K('The fuel tank is below 12 %.'), effect: K('None yet.'),
    steps: [K('Finish the current task.'), K('Refuel at the next opportunity.')], link: ['drive', K('See gauge on Drive')] },
  { key: 'legs', code: 'LEG-01', sev: 'warn', src: K('Support legs'), c: (m) => m.block === 'legs',
    title: K('Drive blocked: support legs are down'), sub: K('Raise all legs to drive'),
    what: K('Drive was requested while one or more support legs are down.'), effect: K('Drive is blocked to protect the legs and the machine.'),
    steps: [K('Set the drive lever to neutral.'), K('Raise all four support legs.'), K('Check the Machine screen shows every leg up.')], link: ['machine', K('Open Machine')] },
  { key: 'park', code: 'BRK-02', sev: 'warn', src: K('Brakes'), c: (m) => m.block === 'park',
    title: K('Parking brake is on'), sub: K('Release it to drive'),
    what: K('Drive was requested with the parking brake applied.'), effect: K('The machine will not move.'),
    steps: [K('Release the parking brake.')], link: ['machine', K('Open Machine')] },
  { key: 'iso2', code: 'ISO-2', sev: 'alarm', src: K('Electrical'), c: (m) => m.insulation < 100,
    title: K('Serious earth leak'), sub: (m) => tx('Insulation {0} kΩ', f0(m.insulation)),
    what: K('The insulation monitor measured below 100 kΩ.'), effect: K('The battery drive system is disabled.'),
    steps: [K('Stop and isolate the machine.'), K('Call an electrician.')] },
  { key: 'iso1', code: 'ISO-1', sev: 'warn', src: K('Electrical'), c: (m) => m.insulation < 500 && m.insulation >= 100,
    title: K('Earth leak detected'), sub: (m) => tx('Insulation {0} kΩ, limit 500 kΩ', f0(m.insulation)),
    what: K('The insulation monitor found a leak to the frame.'), effect: K('None yet. Driving and work are still allowed.'),
    steps: [K('Report it to maintenance this shift.'), K('Look for damaged cables, especially on the cable reel and boom.')] },
];

function seedHistory() {
  const h = [
    { code: '4202', sev: 'warn', src: K('Fuel system'), title: K('Water in fuel pre-filter'), what: K('The pre-filter sensor detected water in the fuel.'), effect: K('None now that it has cleared.'), steps: [K('Drain the pre-filter at the next service stop.')], ago: 170, len: 6 },
    { code: '4133', sev: 'warn', src: K('Work hydraulics'), title: K('Return filter clogged'), what: K('Pressure across the return filter was high. Cold oil at start-up often causes this.'), effect: K('None now that it has cleared.'), steps: [K('If it repeats with warm oil, replace the return filter.')], ago: 260, len: 22 },
    { code: '4138', sev: 'alarm', src: K('Electrical'), title: K('24 V battery critically low'), what: K('Battery voltage dropped below the critical limit during cranking.'), effect: K('None now that it has cleared.'), steps: [K('Have the batteries and charging checked if it repeats.')], ago: 330, len: 2 },
  ];
  h.forEach((d) => {
    const t0 = now() - d.ago * 60e3;
    S.alerts.push({ id: ++S.seq, key: 'seed' + d.code, def: { ...d, sub: d.title }, sev: d.sev, active: false, acked: true, t0, t1: t0 + d.len * 60e3 });
  });
}

function evalAlerts() {
  const m = S.m;
  AD.forEach((d) => {
    const on = !!d.c(m);
    const ex = S.alerts.find((a) => a.key === d.key && a.active);
    if (on && !ex) {
      const a = { id: ++S.seq, key: d.key, def: d, sev: d.sev, active: true, acked: d.sev === 'info', t0: now(), t1: 0 };
      S.alerts.push(a);
      if (d.sev === 'alarm' && !S.boot) openModal({ type: 'alarm', id: a.id });
    } else if (!on && ex) {
      ex.active = false; ex.t1 = now();
      if (S.modal && S.modal.type === 'alarm' && S.modal.id === ex.id) closeModal();
      S.modalQueue = S.modalQueue.filter((q) => !(q.type === 'alarm' && q.id === ex.id));
    }
  });
}
const activeAlerts = () => S.alerts.filter((a) => a.active).sort((a, b) => SEVRANK[a.sev] - SEVRANK[b.sev] || b.t0 - a.t0);
const historyAlerts = () => S.alerts.filter((a) => !a.active).sort((a, b) => b.t1 - a.t1);
const byId = (id) => S.alerts.find((a) => a.id === +id);

/* ================= derived checks ================= */
const dpfBand = () => { const s = S.m.soot; return s >= 100 ? 'max' : s >= 80 ? 'L6' : s >= 70 ? 'L5' : s > 60 ? 'L4' : 'L3'; };
const legsDownCount = () => S.m.legs.filter(Boolean).length;
const legsMoving = () => S.legMove.some(Boolean);
const parkWord = (on) => tx(on ? 'Applied|park' : 'Released|park');
function regenChecks() {
  const m = S.m;
  return [
    { l: tx('Engine running'), v: m.engineOn ? f0(m.rpm) + ' ' + tu('rpm') : tx('Off|engine'), ok: m.engineOn && !m.estop },
    { l: tx('Machine stationary'), v: f1(m.speed) + ' ' + tu('km/h'), ok: m.speed < 0.5 },
    { l: tx('Parking brake applied'), v: parkWord(m.parkBrake), ok: m.parkBrake },
    { l: tx('Transmission in neutral'), v: m.dir, ok: m.dir === 'N' },
    { l: tx('Engine warm'), v: tx('Coolant {0} °C', f0(m.coolant)), ok: m.coolant >= 60 },
  ];
}
function btChecks() {
  const m = S.m;
  return [
    { l: tx('Engine running'), ok: m.engineOn && !m.estop, v: m.engineOn ? tx('Running') : tx('Off|engine') },
    { l: tx('All support legs up'), ok: legsDownCount() === 0 && !legsMoving(), v: tx('{0} down', legsDownCount()) },
    { l: tx('Drive direction forward'), ok: m.dir === 'F', v: m.dir },
    { l: tx('Parking brake released'), ok: !m.parkBrake, v: parkWord(m.parkBrake) },
    { l: tx('Brake pedal pressed and held'), ok: m.pedal, v: tx(m.pedal ? 'Pressed' : 'Released|pedal'), hint: tx('Use Brake pedal in the reviewer panel') },
  ];
}
function readyChecks() {
  const m = S.m;
  const n = legsDownCount();
  return [
    { l: tx('Parking brake applied'), ok: m.parkBrake },
    { l: tx('Transmission in neutral'), ok: m.dir === 'N' },
    { l: n === 4 ? tx('All four legs down') : tx(4 - n === 1 ? '{0} leg not down' : '{0} legs not down', 4 - n), ok: n === 4 && !legsMoving() },
    { l: tx('Emergency stop released'), ok: !m.estop },
    { l: tx('Insulation OK'), ok: m.insulation >= 500 },
    { l: tx('Hydraulic oil below 85 °C'), ok: m.hyd <= 85 },
  ];
}

/* ================= scenarios ================= */
function base() {
  const m = S.m;
  Object.assign(m, { engineOn: true, dir: 'F', throttle: 0.35, parkBrake: false, pedal: false, estop: false, soot: 32, hyd: 64, hydTarget: 64, fuel: 62, insulation: 2000, legs: [false, false, false, false] });
  S.legMove = [null, null, null, null];
  Object.assign(S.regen, { inhibit: true, confirmed: false, running: false, done: false });
  S.bt = { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: false, saved: false };
  S.modal = null; S.modalQueue = []; S.cam = null;
  S.screen = 'drive';
}
function parked() { Object.assign(S.m, { dir: 'N', throttle: 0, parkBrake: true, speed: 0 }); }
const SCEN = [
  { k: 'normal', t: K('Normal shift'), d: K('Driving, all OK'), f() { base(); } },
  { k: 'regen', t: K('Filter needs regen'), d: () => tx('Soot {0}, driving', pct(64)), f() { base(); S.m.soot = 64; } },
  { k: 'ready', t: K('Ready to regenerate'), d: () => tx('Parked, soot {0}', pct(66)), f() { base(); parked(); S.m.soot = 66; S.m.speed = 0; S.screen = 'exhaust'; } },
  { k: 'dpf5', t: K('Filter critical'), d: () => tx('Soot {0}, level {1}', pct(76), 5), f() { base(); S.m.soot = 76; } },
  { k: 'hyd', t: K('Hydraulic overheat'), d: K('Scaling, oil rising'), f() { base(); parked(); S.m.legs = [true, true, true, true]; S.m.hyd = 82; S.m.hydTarget = 97; } },
  { k: 'legs', t: K('Setting up to scale'), d: K('3 legs down, 1 up'), f() { base(); parked(); S.m.legs = [true, true, true, false]; S.legSel = 3; S.screen = 'machine'; } },
  { k: 'earth', t: K('Earth leak'), d: K('Insulation 420 kΩ'), f() { base(); S.m.insulation = 420; } },
  { k: 'fuel', t: K('Low fuel'), d: () => tx('Fuel at {0}', pct(9)), f() { base(); S.m.fuel = 9; } },
];

/* ================= simulation ================= */
let last = now();
function sim(dt) {
  const m = S.m;
  const nowT = now();
  S.legMove.forEach((mv, i) => { if (mv && nowT >= mv.until) { m.legs[i] = mv.to; S.legMove[i] = null; } });
  const anyLeg = m.legs.some(Boolean) || legsMoving();
  const regen = S.regen.running;
  const bt = S.bt.phase === 'running';

  let rpmT = 0;
  if (m.engineOn && !m.estop) rpmT = regen ? P('highIdle') : bt ? 1800 : P('idle') + m.throttle * (P('maxRpm') - P('idle'));
  m.rpm = approach(m.rpm, rpmT, 1800, dt);
  if (m.estop && m.engineOn) m.engineOn = false;

  m.block = null;
  if (m.dir !== 'N' && m.throttle > 0.03) {
    if (m.estop) m.block = 'estop';
    else if (!m.engineOn) m.block = null;
    else if (anyLeg) m.block = 'legs';
    else if (m.parkBrake) m.block = 'park';
    else if (regen) m.block = 'regen';
  }
  const maxG = m.dir === 'R' ? P('maxR') : P('maxF');
  const vmax = [0, 8, 15, 25][maxG] * (m.dir === 'R' ? 0.6 : 1);
  let vT = 0;
  if (m.engineOn && !m.estop && m.dir !== 'N' && !m.block && !m.pedal && !bt) vT = m.throttle * vmax;
  if (bt && !m.pedal) vT = 2.5;
  const decel = m.pedal || m.parkBrake || m.estop ? 14 : 4;
  m.speed = approach(m.speed, vT, vT > m.speed ? 3 : decel, dt);
  if (m.speed < 0.05) m.speed = 0;
  m.gear = m.dir === 'N' ? 0 : Math.max(1, Math.min(maxG, m.speed < 6 ? 1 : m.speed < 13 ? 2 : 3));
  const km = m.speed * dt / 3600; m.odo += km; m.trip += km;
  if (m.engineOn) m.hours += dt / 3600;

  m.coolant = approach(m.coolant, m.engineOn ? 86 + m.throttle * 4 : 45, 0.5, dt);
  m.trans = approach(m.trans, m.engineOn ? 76 + m.speed * 0.2 : 45, 0.3, dt);
  m.hyd = approach(m.hyd, m.hydTarget, 0.8, dt);
  m.exhaustT = approach(m.exhaustT, !m.engineOn ? 60 : regen ? 610 : 260 + m.throttle * 180, regen ? 45 : 30, dt);
  m.acc = m.engineOn ? approach(m.acc, 172 + (Math.random() - 0.5) * 2, 25, dt) : approach(m.acc, 150, 0.6, dt);
  m.brake1 = approach(m.brake1, m.pedal ? 118 + (Math.random() - 0.5) * 2 : 0, 260, dt);
  m.brake2 = approach(m.brake2, m.pedal ? 115 + (Math.random() - 0.5) * 2 : 0, 260, dt);
  m.parkP = approach(m.parkP, m.parkBrake || !m.engineOn ? 0 : 138, 320, dt);
  m.battery = approach(m.battery, m.engineOn ? 27.6 : 24.6, 2, dt);
  if (m.engineOn) m.fuel = Math.max(0, m.fuel - (0.2 + m.throttle) * dt * 0.0006);

  if (!S._histT || nowT - S._histT > 1000) { S._histT = nowT; m.hydHist.push(m.hyd); if (m.hydHist.length > 60) m.hydHist.shift(); }

  if (regen) {
    let why = null;
    if (!m.engineOn || m.estop) why = K('the engine stopped');
    else if (!m.parkBrake) why = K('the parking brake was released');
    else if (m.dir !== 'N') why = K('the drive lever left neutral');
    if (why) { S.regen.running = false; S.regen.confirmed = false; toast(['Regeneration stopped: {0}.', () => tx(why)], 'warn'); }
    else {
      m.soot = Math.max(6, m.soot - 1.6 * dt);
      if (m.soot <= 6.01) { S.regen.running = false; S.regen.done = true; S.regen.count++; toast(['Regeneration complete. Soot load is now {0}.', () => pct(6)]); }
    }
  }

  if (bt) {
    const b = S.bt;
    b.t += dt; b.max1 = Math.max(b.max1, m.brake1); b.max2 = Math.max(b.max2, m.brake2);
    b.dist += m.speed / 3.6 * dt * 100;
    if (m.estop || !m.engineOn) { b.phase = 'fail'; b.reason = 'engine'; }
    else if (b.t >= 5) { b.phase = b.dist < 5 ? 'pass' : 'fail'; b.reason = b.dist < 5 ? '' : 'moved'; }
  }

  if (S.net.phase === 'running') { S.net.p += dt / 3; if (S.net.p >= 1) { S.net.p = 1; S.net.phase = 'done'; } }
  const u = S.svc.usb;
  if (u) {
    if (u.phase === 'countdown') { u.t -= dt; if (u.t <= 0) { u.phase = 'working'; u.p = 0; } }
    else if (u.phase === 'working') { u.p += dt / (u.kind === 'update' ? 5 : 3); if (u.p >= 1) { u.p = 1; u.phase = 'done'; } }
  }
  if (S.access && nowT > S.accessUntil) { S.access = 0; toast(['Logged out after 15 minutes. Back to Operator level.']); }
  if (S.toast && nowT > S.toast.until) S.toast = null;
  if (S.boot && nowT - S.boot.t0 > 4200) { S.boot = null; S.screen = 'drive'; }
  Object.keys(S.outputs).forEach((k) => { if (S.outputs[k] < nowT) delete S.outputs[k]; });
}

/* ================= modal / toast ================= */
function openModal(md) {
  if (S.modal && md.type === 'alarm') { S.modalQueue.push(md); return; }
  S.modal = md;
}
function closeModal() { S.modal = S.modalQueue.shift() || null; }
/* toast message is stored as [key, ...args] so it re-translates if the language changes */
function toast(msg, kind) { S.toast = { msg, kind: kind || 'ok', until: now() + 3800 }; }
const toastText = () => { const [k, ...a] = S.toast.msg; return tx(k, ...a.map((x) => (typeof x === 'function' ? x() : x))); };
function need(level, act, arg) {
  if (S.access >= level) return true;
  S.modal = { type: 'login', sel: level, code: '', err: '', need: level, then: act ? [act, arg] : null };
  return false;
}

/* ================= rendering ================= */
const NAV = [['drive', K('Drive')], ['exhaust', K('Exhaust')], ['alerts', K('Alerts')], ['machine', K('Machine')], ['engine', K('Diagnostics')], ['service', K('Service')]];
const SUBTITLE = {
  drive: () => { const m = S.m; if (m.estop) return tx('Emergency stop pressed'); if (!m.engineOn) return tx('Engine off'); if (S.regen.running) return tx('Regenerating · parked'); if (m.legs.some(Boolean)) return tx('Parked · legs down'); if (m.parkBrake) return tx('Parked'); return tx('Engine running · tram mode'); },
  exhaust: () => tx('Stage V · DPF and SCR'),
  alerts: () => tx('Most severe first'),
  machine: () => (legsDownCount() === 4 ? tx('Set up to scale') : legsDownCount() ? tx('Setting up') : tx('Transport position')),
  engine: () => tx({ engine: 'Diesel engine', io: 'Module inputs and outputs', net: 'Control network', brake: 'Brake system test' }[S.diag]),
  service: () => tx('Logs, settings, calibration'),
};

function topbar() {
  const act = activeAlerts();
  const nA = act.filter((a) => a.sev === 'alarm'); const nW = act.filter((a) => a.sev === 'warn');
  let chips = '';
  if (nA.length) chips += `<button class="chip alarm ${nA.some((a) => !a.acked) ? 'new' : ''}" data-act="nav" data-arg="alerts">${I.alerts}${tx(nA.length > 1 ? '{0} Alarms' : '{0} Alarm', nA.length)}</button>`;
  if (nW.length) chips += `<button class="chip warn ${nW.some((a) => !a.acked) ? 'new' : ''}" data-act="nav" data-arg="alerts">${I.warn}${tx(nW.length > 1 ? '{0} Warnings' : '{0} Warning', nW.length)}</button>`;
  if (!nA.length && !nW.length) chips += `<button class="chip clear" data-act="nav" data-arg="alerts">${tx('No active alerts')}</button>`;
  if (S.m.exhaustT > 450) chips += `<button class="chip hot" data-act="nav" data-arg="exhaust">${I.flame}${tx('Hot exhaust')}</button>`;
  const acc = S.access
    ? `<button class="tbtn lvl2" data-act="login">${I.key}${esc(tx('{0} · until {1}', lvlName(S.access), hhmm(S.accessUntil)))}</button>`
    : `<button class="tbtn" data-act="login">${I.user}${tx('Operator')}</button>`;
  const title = tx(NAV.find((n) => n[0] === S.screen)[1]);
  return `<header class="topbar">
    <div style="display:flex;gap:8px;align-items:center">${chips}</div>
    <div class="top-title"><b>${esc(title)}</b><span data-live="sub">${esc(SUBTITLE[S.screen]())}</span></div>
    <button class="tbtn langsw" data-act="langToggle" aria-label="${esc(tx('Change language. Current: English'))}"><span class="${S.lang === 'en' ? 'on' : ''}">EN</span><span class="${S.lang === 'tr' ? 'on' : ''}">TR</span></button>
    <button class="tbtn" data-act="camera" aria-label="${esc(tx('Open cameras'))}">${I.camera}</button>
    <button class="tbtn" data-act="theme" aria-label="${esc(tx(S.theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'))}">${S.theme === 'night' ? I.sun : I.moon}</button>
    ${acc}
    <span class="clock" data-live="clock">${hhmm(now())}</span>
  </header>`;
}

function rail() {
  return `<nav class="rail" aria-label="${esc(tx('Main menu'))}">${NAV.map(([k, label]) => {
    let extra = '';
    if (k === 'exhaust' && S.m.soot > 60) extra = `<span class="dot ${S.m.soot >= 80 ? 'red' : ''}"></span>`;
    if (k === 'alerts') { const n = S.alerts.filter((a) => a.active && !a.acked).length; if (n) extra = `<span class="badge">${n}</span>`; }
    const on = S.screen === k;
    return `<button class="${on ? 'on' : ''}" data-act="nav" data-arg="${k}" ${on ? 'aria-current="page"' : ''}>${I[k]}<span>${esc(tx(label))}</span>${extra}</button>`;
  }).join('')}</nav>`;
}

/* percent-aware live value: Turkish puts % before the number */
const liveVal = (key, unit, numStyle, unitStyle) => {
  const n = `<span data-live="${key}"></span>`;
  const u = `<small style="${unitStyle || ''}">${esc(tu(unit))}</small>`;
  if (unit === '%' && S.lang === 'tr') return `<small style="${unitStyle || ''}">%</small>${n}`;
  return unit ? `${n} ${u}` : n;
};

/* ---------- Drive ---------- */
function scrDrive() {
  const m = S.m;
  const dirs = ['R', 'N', 'F'].map((d) => `<span class="dirbox ${m.dir === d ? 'on' : ''}">${d}</span>`).join('');
  const band = dpfBand();
  const dpfWarn = band !== 'L3';
  const blockMsg = { legs: tx('Drive blocked · legs down'), park: tx('Parking brake on'), estop: tx('Emergency stop'), regen: tx('Regenerating') }[m.block];
  const inds = activeInds();
  const shown = inds.slice(0, S.lang === 'tr' ? 3 : 4);
  const more = inds.length - shown.length;
  const gaugeRows = GAUGES.map((g) => {
    const st = gState(g);
    return `<div class="gauge st-${st}"><span class="gl">${esc(tx(g.label))}</span><div class="track"><div class="fill" data-w="g:${g.k}"></div>${g.warn != null ? `<div class="tick" style="left:${gPct(g, g.warn)}%"></div>` : ''}</div><span class="gv num">${liveVal('g:' + g.k, g.unit)}</span></div>`;
  }).join('');
  const levelTxt = band === 'L3' ? tx('Normal') : tx('Level {0}', band.slice(1));
  return `<main class="main"><div class="col" style="flex:1">
    <div style="flex:1;min-height:0;display:flex;gap:20px">
      <section class="col" style="width:500px;flex:none" aria-label="${esc(tx('Speed and drivetrain'))}">
        <div class="card" style="flex:1;padding:20px 24px;display:flex;flex-direction:column;justify-content:space-between;position:relative">
          ${blockMsg ? `<span class="pill warn" style="position:absolute;top:18px;right:18px;height:36px;font-size:16px">${esc(blockMsg)}</span>` : ''}
          <div style="display:flex;align-items:flex-end;gap:14px"><span class="num" style="font-size:176px;line-height:.82;letter-spacing:-.02em" data-live="speed">0</span><span class="mut" style="font-size:26px;font-weight:500;padding-bottom:6px">${tu('km/h')}</span></div>
          <div style="display:flex;align-items:center;gap:10px">${dirs}
            <div style="margin-left:14px;display:flex;flex-direction:column"><span class="num" style="font-size:40px;line-height:1" data-live="gear"></span><span class="mut" style="font-size:15px" data-live="gearSub"></span></div>
          </div>
        </div>
        <div class="card" style="padding:14px 24px 16px">
          <div class="card-h" style="margin-bottom:10px"><span class="mut" style="font-size:16px;font-weight:500">${tx('Engine speed')}</span><span class="num" style="font-size:30px"><span data-live="rpm"></span> <small class="mut" style="font:500 17px Barlow,sans-serif">${tu('rpm')}</small></span></div>
          <div class="track" style="height:18px;border-radius:4px;overflow:hidden">
            <div style="position:absolute;left:84.6%;top:0;bottom:0;width:7.7%;background:var(--amberSoft)"></div>
            <div style="position:absolute;left:92.3%;top:0;bottom:0;right:0;background:var(--redSoft)"></div>
            <div class="fill" data-w="rpm" style="border-radius:0"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--faint);margin-top:6px"><span>0</span><span>1000</span><span>2000</span><span>2600</span></div>
        </div>
        <button class="card ${band === 'L3' ? '' : band === 'L4' || band === 'L5' ? 'warn' : 'alarm'}" data-act="nav" data-arg="exhaust" style="display:flex;align-items:center;gap:16px;padding:14px 18px 14px 20px;min-height:78px;text-align:left;width:100%">
          <span style="flex:1;display:flex;flex-direction:column;gap:8px">
            <span class="card-h"><span style="font-size:16px;font-weight:600">${tx('Exhaust filter (DPF)')}</span><span style="font-size:15px;color:var(--txt2)">${tx('Soot')} ${S.lang === 'tr' ? '%<span data-live="soot"></span>' : '<span data-live="soot"></span> %'} · ${esc(levelTxt)}</span></span>
            <span class="track" style="height:8px;display:block"><span class="fill" data-w="soot" style="${dpfWarn ? 'background:var(--amber)' : ''}"></span></span>
          </span>
          <span class="btn sm ${dpfWarn ? 'amber' : ''}">${tx(S.regen.running ? 'Running' : dpfWarn ? 'Regenerate' : 'Details')}</span>
        </button>
      </section>
      <section class="card" style="flex:1;min-width:0;padding:12px 20px;display:flex;flex-direction:column" aria-label="${esc(tx('Fluids, temperatures and pressures'))}">
        <div class="card-h" style="padding-bottom:6px;border-bottom:1px solid var(--line)"><span class="mut" style="font-size:16px;font-weight:500">${tx('Fluids, temperatures and pressures')}</span><span style="font-size:14px;color:var(--faint)">${tx('Tick = warning limit')}</span></div>
        ${gaugeRows}
      </section>
    </div>
    <section style="height:72px;flex:none;display:flex;align-items:center;gap:10px;background:var(--panel2);border:1px solid var(--line);border-radius:14px;padding:0 12px" aria-label="${esc(tx('Active now'))}">
      <span class="kicker" style="width:92px;flex:none;line-height:1.2">${tx('Active now')}</span>
      <div class="indrow">${shown.map((i) => { const lab = i.k === 'dpf' && S.regen.running ? tx('Regenerating') : tx(i.l); return `<button class="ind ${i.st}" data-act="nav" data-arg="${i.go || 'machine'}" title="${esc(lab)}">${esc(lab)}</button>`; }).join('')}
      ${more > 0 ? `<button class="ind go" style="flex:none" data-act="indAll">${tx('+{0} more', more)}</button>` : ''}</div>
      <button class="ind go" style="flex:none" data-act="indAll">${tx('All indicators')}</button>
    </section>
    <section style="height:48px;flex:none;display:flex;align-items:center;gap:24px;padding:0 6px;font-size:16px;color:var(--mut);white-space:nowrap" aria-label="${esc(tx('Trip data'))}">
      <span>${tx('Odometer')} <b class="num" style="font-size:22px;color:var(--txt)" data-live="odo"></b> km</span>
      <span>${tx('Trip')} <b class="num" style="font-size:22px;color:var(--txt)" data-live="trip"></b> km</span>
      <button class="btn sm hold" data-hold="resetTrip" aria-label="${esc(tx('Hold for 2 seconds to reset trip'))}"><span class="prog"></span><span style="position:relative">${tx('Hold to reset trip')}</span></button>
      <span>${tx('Engine')} <b class="num" style="font-size:22px;color:var(--txt)" data-live="hours"></b> ${tu('h')}</span>
      <span>${tx('Battery')} <b class="num" style="font-size:22px;color:var(--txt)" data-live="battery"></b> V</span>
      <span>${tx('Ambient')} <b class="num" style="font-size:22px;color:var(--txt)">${S.m.ambient}</b> °C</span>
    </section>
  </div></main>`;
}

/* ---------- Exhaust ---------- */
function scrExhaust() {
  const m = S.m; const r = S.regen; const band = dpfBand();
  const LV = [
    ['L3', pct('0–60'), K('Normal. No action needed.')],
    ['L4', pct('61–69'), K('Regenerate as soon as possible.')],
    ['L5', pct('70–79'), K('Regenerate now. Warning lamp flashes.')],
    ['L6', pct('80–99'), K('Service tool needed. Engine derated. Call the workshop.')],
    ['max', pct('100'), K('Filter must be removed. Call the workshop now.')],
  ];
  const sevOf = { L3: 'ok', L4: 'warn', L5: 'warn', L6: 'alarm', max: 'alarm' };
  const badge = { L3: ['ok', K('Normal')], L4: ['warn', K('Level 4 · regenerate soon')], L5: ['warn', K('Level 5 · regenerate now')], L6: ['alarm', K('Level 6 · workshop')], max: ['alarm', K('Full · workshop')] }[band];
  const checks = regenChecks();
  const allAuto = checks.every((c) => c.ok);
  const needed = m.soot > 60 && m.soot < 80;
  const ready = allAuto && !r.inhibit && r.confirmed && needed;
  const left = checks.filter((c) => !c.ok).length + (r.inhibit ? 1 : 0) + (r.confirmed ? 0 : 1);
  const sootLive = S.lang === 'tr' ? '%<span data-live="soot"></span>' : '<span data-live="soot"></span> %';
  let right;
  if (r.running) {
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:18px;justify-content:center">
      <div style="display:flex;align-items:center;gap:12px;color:var(--hot);font-size:21px;font-weight:700"><span style="width:30px;height:30px">${I.flame}</span>${tx('Regeneration running · exhaust is very hot')}</div>
      <div><div class="card-h" style="font-size:16px;color:var(--mut);margin-bottom:8px"><span>${tx('Soot burned')}</span><span style="color:var(--txt)">${pct(f0(r.from))} → ${sootLive}</span></div>
      <div class="progress"><div data-w="regen"></div></div>
      <p class="mini" style="margin-top:8px">${tx('Exhaust')} <b data-live="exhaustT" style="color:var(--txt)"></b> °C · ${tx('engine at high idle')} <b data-live="rpm" style="color:var(--txt)"></b> ${tu('rpm')}. ${tx('Demo runs about 30 times faster than a real regeneration.')}</p></div>
      <ul style="margin:0;padding-left:22px;font-size:17px;line-height:1.6;color:var(--txt2)"><li>${tx('Driving and boom controls are locked.')}</li><li>${tx('Releasing the parking brake or leaving neutral stops it.')}</li><li>${tx('Keep people 0.6 m and anything flammable 1.5 m from the outlet.')}</li></ul>
      <button class="btn block" data-act="regenStop">${I.stop}${tx('Stop regeneration')}</button></div>`;
  } else if (r.done) {
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;text-align:center">
      <span style="width:64px;height:64px;color:var(--ok)">${I.okc}</span>
      <h2 style="margin:0;font-size:28px">${tx('Regeneration complete')}</h2>
      <p class="mini" style="font-size:17px">${tx('Soot load now:')} <b style="color:var(--txt)">${sootLive}</b>. ${tx('The exhaust stays hot for a few minutes.')}</p>
      <button class="btn pri" data-act="regenDone" style="min-width:240px">${tx('Done')}</button></div>`;
  } else {
    let startTxt;
    if (ready) startTxt = I.play + tx('Start regeneration');
    else if (!needed) startTxt = tx('Regeneration not available');
    else startTxt = tx(left === 1 ? '{0} check left before you can start' : '{0} checks left before you can start', left);
    right = `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px">
      ${checks.map((c) => `<li class="check ${c.ok ? '' : 'bad'}" style="min-height:46px"><span class="${c.ok ? 'okdot' : 'baddot'}"></span><span class="ct">${esc(c.l)}</span><span class="cv">${esc(c.v)}</span></li>`).join('')}
      <li class="check ${r.inhibit ? 'bad' : ''}"><span class="${r.inhibit ? 'baddot' : 'okdot'}"></span><span class="ct">${tx('Regeneration inhibit switch')}<small>${tx(r.inhibit ? 'Set to Permit, or regeneration cannot start.' : 'Permit. Regeneration is allowed.')}</small></span><button class="btn sm ${r.inhibit ? 'pri' : ''}" data-act="inhibit" style="min-width:132px">${tx(r.inhibit ? 'Set Permit' : 'Set Inhibit')}</button></li>
      <li class="check ${r.confirmed ? '' : 'bad'}"><span class="${r.confirmed ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('Exhaust area is clear')}<small>${tx('Nothing that can burn, melt or explode within 1.5 m. Nobody within 0.6 m.')}</small></span><button class="btn sm ${r.confirmed ? '' : 'pri'}" data-act="confirmArea" aria-pressed="${r.confirmed}" style="min-width:132px">${tx(r.confirmed ? 'Confirmed' : 'I checked')}</button></li>
    </ul>
    <div style="flex:1"></div>
    ${!needed ? `<p class="mini" style="text-align:center">${tx(m.soot >= 80 ? 'Too full for a standstill regeneration. A service tool is needed.' : 'Not needed yet. Soot is below 61 %.')}</p>` : ''}
    <button class="btn ${ready ? 'go' : ''} block" data-act="regenStart" ${ready ? '' : 'disabled'} style="min-height:68px;font-size:21px">${startTxt}</button>`;
  }
  return `<main class="main">
    <section class="col" style="width:540px;flex:none" aria-label="${esc(tx('Particulate filter · soot load'))}">
      <div class="card pad">
        <div class="card-h" style="align-items:flex-start"><div><div class="mut" style="font-size:16px;font-weight:500">${tx('Particulate filter · soot load')}</div>
          <div class="num" style="font-size:92px;line-height:.92;color:${band === 'L3' ? 'var(--txt)' : sevOf[band] === 'warn' ? 'var(--amberTxt)' : 'var(--redTxt)'}">${S.lang === 'tr' ? '<span style="font-size:40px">%</span><span data-live="soot"></span>' : '<span data-live="soot"></span><span style="font-size:40px">%</span>'}</div></div>
          <span class="pill ${badge[0] === 'ok' ? 'ok' : badge[0]}" style="height:38px;font-size:16px">${tx(badge[1])}</span></div>
        <div style="margin-top:16px;position:relative">
          <div style="display:flex;height:22px;border-radius:5px;overflow:hidden;gap:2px"><div style="width:60%;background:var(--line3)"></div><div style="width:10%;background:#8A6A33"></div><div style="width:10%;background:#C58A2E"></div><div style="width:20%;background:#A9372F"></div></div>
          <div data-left="soot" style="position:absolute;top:-6px;height:34px;width:5px;margin-left:-2px;border-radius:2px;background:var(--txt);box-shadow:0 0 0 2px var(--panel)"></div>
          <div style="display:flex;font-size:13px;color:var(--faint);margin-top:8px"><span style="width:60%">0</span><span style="width:10%">60</span><span style="width:10%">70</span><span style="width:20%;display:flex;justify-content:space-between"><span>80</span><span>${pct(100)}</span></span></div>
        </div>
      </div>
      <div class="card" style="flex:1;padding:8px;display:flex;flex-direction:column;gap:2px">
        ${LV.map(([k, rg, w]) => { const on = k === band; const s = sevOf[k]; return `<div style="flex:1;display:flex;align-items:center;gap:12px;padding:0 12px;border-radius:8px;${on ? (s === 'ok' ? 'background:var(--panel3);' : s === 'warn' ? 'background:var(--amberSoft);box-shadow:inset 0 0 0 1px var(--amber);color:var(--amberTxt);' : 'background:var(--redSoft);box-shadow:inset 0 0 0 1px var(--red);color:var(--redTxt);') : 'color:var(--txt2);'}"><span class="num" style="font-size:22px;width:52px">${k === 'max' ? tx('Max') : k.replace('L', tx('L|level abbr'))}</span><span style="font-size:15px;width:76px;color:var(--mut)">${rg}</span><span style="flex:1;font-size:16px;line-height:1.25">${tx(w)}</span>${on ? `<span class="pill on" style="height:26px;font-size:13px">${tx('NOW')}</span>` : ''}</div>`; }).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">
        <div class="stat"><div class="k">${tx('Ash load')}</div><div class="v">${S.lang === 'tr' ? '<small>%</small>' + S.m.ash : S.m.ash + '<small> %</small>'}</div></div>
        <div class="stat"><div class="k">${tx('DEF tank')}</div><div class="v">${S.lang === 'tr' ? '<small>%</small><span data-live="g:def"></span>' : '<span data-live="g:def"></span><small> %</small>'}</div></div>
        <div class="stat"><div class="k">${tx('Exhaust')}</div><div class="v"><span data-live="exhaustT"></span><small> °C</small></div></div>
        <div class="stat"><div class="k">${tx('Engine derate')}</div><div class="v" style="${m.soot >= 80 ? 'color:var(--redTxt)' : ''}">${tx(m.soot >= 80 ? 'Active' : 'None')}</div></div>
      </div>
    </section>
    <section class="card" style="flex:1;min-width:0;padding:20px 24px;display:flex;flex-direction:column;gap:12px" aria-label="${esc(tx('Standstill regeneration'))}">
      <div><h2 style="margin:0;font-size:26px;font-weight:600">${tx('Standstill regeneration')}</h2>
      <p class="mini" style="font-size:16px;margin-top:4px">${tx('The engine burns off soot at high idle. Stay with the machine until it finishes. Checks update live from the machine.')}</p></div>
      ${right}
    </section>
  </main>`;
}

/* ---------- Alerts ---------- */
function scrAlerts() {
  const act = activeAlerts(); const hist = historyAlerts();
  const isAct = S.alertTab === 'active';
  const list = isAct ? act : hist;
  let sel = byId(S.alertSel);
  if (!sel || !list.includes(sel)) sel = list[0] || null;
  if (sel) S.alertSel = sel.id;
  const rows = list.map((a) => {
    const d = a.def;
    const sub = isAct ? `${tf(d.sub)} · ${ago(a.t0)}` : tx('Cleared {0} · lasted {1}', hhmm(a.t1), dur(a.t1 - a.t0));
    return `<button class="arow ${sel && sel.id === a.id ? 'sel' : ''}" data-act="aSel" data-arg="${a.id}">
      <span class="sev ${a.sev}">${a.sev === 'info' ? 'i' : '!'}</span>
      <span style="flex:1;min-width:0"><span class="t">${esc(tf(d.title))}</span><span class="s">${esc(sub)}</span></span>
      ${isAct ? (a.acked ? `<span class="pill off">${tx('Seen')}</span>` : `<span class="pill on">${tx('New')}</span>`) : `<span class="pill off">${tx('Cleared')}</span>`}
    </button>`;
  }).join('');
  let detail;
  if (!sel) {
    detail = `<section class="card" style="flex:1;min-width:0;padding:20px 24px;display:flex"><div class="empty"><span style="width:56px;height:56px;color:var(--ok)">${I.okc}</span>${tx(isAct ? 'No active alerts. The machine is OK.' : 'History is empty.')}</div></section>`;
  } else {
    const d = sel.def; const bc = sel.sev === 'alarm' ? 'var(--red)' : sel.sev === 'warn' ? 'var(--amber)' : 'var(--line)';
    const trend = d.trend ? `<div style="background:var(--panel2);border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:16px">
        <svg width="430" height="70" viewBox="0 0 430 70" role="img" aria-label="${esc(tx('Hydraulic oil temperature over the last minute'))}"><line x1="0" y1="${70 - 35 * 1.4}" x2="430" y2="${70 - 35 * 1.4}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="5 4"/><line x1="0" y1="${70 - 40 * 1.4}" x2="430" y2="${70 - 40 * 1.4}" stroke="var(--redTxt)" stroke-width="1.5" stroke-dasharray="5 4"/><polyline data-points="hyd" fill="none" stroke="var(--txt)" stroke-width="3" stroke-linejoin="round"/></svg>
        <div class="mini">${tx('Last 60 s')}<br><span style="color:var(--amberTxt)">${tx('85 °C warning')}</span><br><span style="color:var(--redTxt)">${tx('90 °C alarm')}</span></div></div>` : '';
    const when = sel.active ? tx('Started {0} · {1}', ago(sel.t0), hhmm(sel.t0)) : `${hhmm(sel.t0)}–${hhmm(sel.t1)}`;
    detail = `<section class="card" style="flex:1;min-width:0;padding:20px 24px;display:flex;flex-direction:column;gap:14px;border-color:${bc}" aria-label="${esc(tx('Alert detail'))}">
      <div class="card-h" style="align-items:center"><span class="pill ${sel.sev === 'info' ? 'off' : sel.sev}" style="height:34px;font-size:16px">${tx(SEVNAME[sel.sev])}</span>
        <span class="mono mut" style="font-size:14px;flex:1;margin-left:12px">${esc(tx('Code {0} · {1}', d.code, tx(d.src)))}</span><span class="mut" style="font-size:15px">${esc(when)}</span></div>
      <h2 style="margin:0;font-size:30px;line-height:1.15;font-weight:600">${esc(tf(d.title))}</h2>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
        <div style="background:var(--panel2);border-radius:12px;padding:12px 16px"><div class="kicker" style="margin-bottom:6px">${tx('What is happening')}</div><div style="font-size:17px;line-height:1.4">${esc(tf(d.what))}</div></div>
        <div style="background:var(--panel2);border-radius:12px;padding:12px 16px"><div class="kicker" style="margin-bottom:6px">${tx('Effect on the machine')}</div><div style="font-size:17px;line-height:1.4">${esc(tf(d.effect))}</div></div>
      </div>
      <div><div class="kicker" style="margin-bottom:6px">${tx('What to do')}</div><ol style="margin:0;padding-left:26px;font-size:18px;line-height:1.5">${d.steps.map((s) => `<li>${esc(tf(s))}</li>`).join('')}</ol></div>
      ${trend}
      <div style="flex:1"></div>
      <div style="display:flex;gap:12px">
        ${sel.active ? `<button class="btn ${sel.acked ? '' : 'pri'}" style="flex:1" data-act="ack" data-arg="${sel.id}" ${sel.acked ? 'disabled' : ''}>${tx(sel.acked ? 'Acknowledged' : 'Acknowledge')}</button>` : ''}
        ${d.link ? `<button class="btn" style="flex:1" data-act="nav" data-arg="${d.link[0]}">${esc(tx(d.link[1]))}</button>` : ''}
      </div></section>`;
  }
  const unacked = act.filter((a) => !a.acked).length;
  return `<main class="main">
    <section class="col" style="width:500px;flex:none;gap:12px" aria-label="${esc(tx('Alert list'))}">
      <div class="tabs" role="tablist"><button role="tab" class="${isAct ? 'on' : ''}" aria-selected="${isAct}" data-act="aTab" data-arg="active">${tx('Active · {0}', act.length)}</button><button role="tab" class="${!isAct ? 'on' : ''}" aria-selected="${!isAct}" data-act="aTab" data-arg="history">${tx('History · {0}', hist.length)}</button></div>
      <div class="alist">${rows || `<div class="empty">${tx(isAct ? 'Nothing active.' : 'No cleared alerts.')}</div>`}</div>
      <div style="display:flex;gap:10px">
        ${isAct ? `<button class="btn sm" style="flex:1" data-act="ackAll" ${unacked ? '' : 'disabled'}>${tx('Acknowledge all')}${unacked ? ' · ' + unacked : ''}</button>`
    : `<button class="btn sm" style="flex:1" data-act="saveAlertsUsb">${I.usb}${tx('Save to USB')}</button><button class="btn sm" style="flex:1" data-act="clearHist" ${hist.length ? '' : 'disabled'}>${S.access < 1 ? I.lock : ''}${tx('Clear history')}</button>`}
      </div>
    </section>
    ${detail}
  </main>`;
}

/* ---------- Machine ---------- */
const LEGNAMES = [K('Left front'), K('Right front'), K('Left rear'), K('Right rear')];
function scrMachine() {
  const m = S.m;
  const POS = ['left:16px;top:206px', 'right:16px;top:206px', 'left:16px;top:522px', 'right:16px;top:522px'];
  const legs = m.legs.map((d, i) => {
    const mv = S.legMove[i];
    const state = mv ? tx(mv.to ? 'Lowering…' : 'Raising…') : tx(d ? 'Down · out' : 'Up · in');
    return `<button class="legbtn ${d && !mv ? '' : 'up'} ${mv ? 'moving' : ''} ${S.legSel === i ? 'sel' : ''}" style="${POS[i]}" data-act="legSel" data-arg="${i}" aria-pressed="${S.legSel === i}"><small>${tx(LEGNAMES[i])}</small><b>${state}</b></button>`;
  }).join('');
  const rc = readyChecks(); const bad = rc.filter((c) => !c.ok).length;
  const i = S.legSel; const d = m.legs[i]; const mv = S.legMove[i];
  const chip = (v, k) => `<span class="pill ${k}">${tx(v)}</span>`;
  const rows = [
    [K('Leg on ground'), d && !mv ? chip('Yes', 'on') : chip('No', 'warn')],
    [K('Fully raised'), !d && !mv ? chip('Yes', 'on') : chip('No', 'off')],
    [K('Extension fully out'), d && !mv ? chip('Yes', 'on') : chip('No', 'off')],
    [K('Extension fully in'), !d && !mv ? chip('Yes', 'on') : chip('No', 'off')],
    [K('Valve: down'), mv && mv.to ? chip('On|valve', 'acc') : chip('Off|valve', 'off')],
    [K('Valve: up'), mv && !mv.to ? chip('On|valve', 'acc') : chip('Off|valve', 'off')],
    [K('Valve: out'), mv && mv.to ? chip('On|valve', 'acc') : chip('Off|valve', 'off')],
    [K('Valve: in'), mv && !mv.to ? chip('On|valve', 'acc') : chip('Off|valve', 'off')],
  ];
  const n = legsDownCount();
  const limits = n === 4 ? [tx('Full|limit'), tx('Full|limit'), tx('All four legs are down and extended.')] : n === 0 ? [tx('Locked'), tx('Locked'), tx('Lower the legs before using the boom.')] : ['±15°', '30°', tx('Reduced until all four legs are down and extended.')];
  return `<main class="main">
    <section class="card legmap" aria-label="${esc(tx('Support legs, top view'))}">
      <div style="position:absolute;left:20px;top:16px;right:20px" class="card-h"><span class="mut" style="font-size:16px;font-weight:500">${tx('Support legs · tap a leg')}</span><span class="mut" style="font-size:15px">${tx('Front ↑')}</span></div>
      <div class="part" style="left:205px;top:56px;width:30px;height:130px"></div>
      <div class="part" style="left:186px;top:48px;width:68px;height:22px;opacity:.8"></div>
      <div style="position:absolute;left:252px;top:92px;width:150px;font-size:14px;color:var(--mut);line-height:1.3">${tx('Boom in transport position')}</div>
      <div class="part" style="left:60px;top:240px;right:60px;height:14px"></div>
      <div class="part" style="left:60px;top:556px;right:60px;height:14px"></div>
      <div style="position:absolute;left:130px;top:170px;width:180px;height:440px;border-radius:22px;background:var(--panel3);border:1px solid var(--line3)"></div>
      <div style="position:absolute;left:150px;top:300px;width:140px;height:110px;border-radius:12px;background:var(--panel2);border:1px solid var(--line3);display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--mut)">${tx('Cab')}</div>
      <div style="position:absolute;left:150px;top:430px;width:140px;text-align:center"><div class="mut" style="font-size:14px">${tx('Wheels')}</div><div style="font-size:16px;font-weight:600">${tx('Straight F / R')}</div></div>
      ${legs}
    </section>
    <div class="col" style="flex:1">
      <section class="card pad ${bad ? 'warn' : ''}" aria-label="${esc(tx('Ready to scale?'))}">
        <div class="card-h" style="margin-bottom:10px;align-items:center"><h2>${tx('Ready to scale?')}</h2>${bad ? `<span class="pill warn" style="height:36px;font-size:16px">${tx(bad > 1 ? 'Not yet · {0} items' : 'Not yet · {0} item', bad)}</span>` : `<span class="pill ok" style="height:36px;font-size:16px">${tx('Ready')}</span>`}</div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 20px">${rc.map((c) => `<div style="display:flex;align-items:center;gap:12px;height:38px;font-size:17px;${c.ok ? '' : 'color:var(--amberTxt)'}"><span class="${c.ok ? 'okdot' : 'baddot'}"></span>${esc(c.l)}</div>`).join('')}</div>
      </section>
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:10px" aria-label="${esc(tx('{0} leg', tx(LEGNAMES[i])))}">
        <div class="card-h"><h2>${tx('{0} leg', tx(LEGNAMES[i]))}</h2><span class="mut" style="font-size:15px">${tx('Limit switches and valves · live')}</span></div>
        <div class="kv">${rows.map(([l, c]) => `<div><span>${tx(l)}</span>${c}</div>`).join('')}</div>
        <p class="mini">${tx(mv ? 'The leg is moving. Valve outputs show which way.' : d ? 'All switches agree. This leg is carrying load.' : 'Lower and extend this leg with the support leg controls.')}</p>
      </section>
      <section class="card" style="height:84px;flex:none;padding:0 22px;display:flex;align-items:center;gap:24px" aria-label="${esc(tx('Boom limits with current legs'))}">
        <span class="mut" style="font-size:16px;font-weight:500;width:140px;line-height:1.25">${tx('Boom limits with current legs')}</span>
        <span class="mut" style="font-size:16px">${tx('Slew')} <b class="num" style="display:block;font-size:28px;color:${n === 4 ? 'var(--txt)' : 'var(--amberTxt)'}">${limits[0]}</b></span>
        <span class="mut" style="font-size:16px">${tx('Lift')} <b class="num" style="display:block;font-size:28px;color:${n === 4 ? 'var(--txt)' : 'var(--amberTxt)'}">${limits[1]}</b></span>
        <span class="mini" style="flex:1">${limits[2]}</span>
        <button class="btn sm" data-act="indAll">${tx('All indicators')}</button>
      </section>
    </div>
  </main>`;
}

/* ---------- Diagnostics ---------- */
const MODULES = [
  { id: 'mid', n: K('Display (MID)'), node: 1, fw: '3.4.12', st: 'ok' },
  { id: 'app', n: K('Application controller'), node: 2, fw: '3.4.12', st: 'ok' },
  { id: 'ioF', n: K('I/O module, front'), node: 10, fw: '2.1.7', st: 'ok' },
  { id: 'ioR', n: K('I/O module, rear'), node: 11, fw: '2.1.7', st: 'ok' },
  { id: 'ioB', n: K('I/O module, boom'), node: 12, fw: '2.1.7', st: 'ok' },
  { id: 'ecu', n: K('Engine controller'), node: 0, fw: 'J1939', st: 'ok' },
  { id: 'tcu', n: K('Transmission controller'), node: 3, fw: '1.9.0', st: 'ok' },
  { id: 'joyL', n: K('Joystick, left'), node: 20, fw: '1.2.3', st: 'ok' },
  { id: 'joyR', n: K('Joystick, right'), node: 21, fw: '1.2.3', st: 'ok' },
  { id: 'rc', n: K('Wireless remote'), node: 30, fw: '—', st: 'off' },
];
const numU = (key, unit, size) => `<b class="num" style="font-size:${size || 24}px">${liveVal(key, unit, '', 'font:500 15px Barlow;color:var(--mut)')}</b>`;
function scrEngine() {
  const tabs = [['engine', K('Engine')], ['io', K('Module I/O')], ['net', K('Network')], ['brake', K('Brake test')]];
  let body = '';
  const m = S.m;
  if (S.diag === 'engine') {
    const kv = [[K('Engine speed'), 'rpm', 'rpm'], [K('Engine load'), 'load', '%'], [K('Coolant temperature'), 'g:coolant', '°C'], [K('Coolant level'), null, pct(92)], [K('Oil pressure'), 'oilP', 'bar'], [K('Oil temperature'), 'oilT', '°C'], [K('Boost pressure'), 'boost', 'bar'], [K('Intake manifold temp'), 'intake', '°C'], [K('Fuel rate'), 'fuelRate', 'l/h'], [K('Battery'), 'battery', 'V'], [K('Engine hours'), 'hours', 'h'], [K('Exhaust temperature'), 'exhaustT', '°C']];
    const band = dpfBand();
    body = `<div style="display:flex;gap:20px;flex:1;min-height:0">
      <section class="card pad" style="flex:1.4;display:flex;flex-direction:column;gap:12px"><div class="card-h"><h2>${tx('Diesel engine')}</h2><span class="pill ${m.engineOn ? 'ok' : 'off'}">${tx(m.engineOn ? 'Running' : 'Stopped')}</span></div>
        <div class="kv" style="flex:1;align-content:start">${kv.map(([l, k, u]) => `<div><span>${tx(l)}</span>${k ? numU(k, u) : `<b class="num" style="font-size:24px">${u}</b>`}</div>`).join('')}</div></section>
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:12px"><div class="card-h"><h2>${tx('Aftertreatment')}</h2><span class="pill ${band === 'L3' ? 'ok' : band === 'L6' || band === 'max' ? 'alarm' : 'warn'}">${band === 'L3' ? tx('Normal') : tx('Level {0}', band.replace('L', ''))}</span></div>
        <div class="kv" style="grid-template-columns:1fr">
          <div><span>${tx('Soot load')}</span>${numU('soot', '%')}</div>
          <div><span>${tx('Ash load')}</span><b class="num" style="font-size:24px">${pct(m.ash)}</b></div>
          <div><span>${tx('DEF tank')}</span>${numU('g:def', '%')}</div>
          <div><span>${tx('Regenerations')}</span><b class="num" style="font-size:24px">${S.regen.count}</b></div>
          <div><span>${tx('Particulate control (PCD)')}</span><span class="pill ok">${tx('No fault')}</span></div>
          <div><span>${tx('SCR system')}</span><span class="pill ok">${tx('No fault')}</span></div>
          <div><span>${tx('Regeneration switch')}</span><span class="pill ${S.regen.inhibit ? 'warn' : 'ok'}">${tx(S.regen.inhibit ? 'Inhibit|state' : 'Permit|state')}</span></div>
        </div>
        <div style="flex:1"></div><button class="btn" data-act="nav" data-arg="exhaust">${tx('Open Exhaust')}</button></section></div>`;
  } else if (S.diag === 'io') {
    const st = (on, a, b, k = 'on') => `<span class="pill ${on ? k : 'off'}">${tx(on ? a : b)}</span>`;
    const outs = S.outputs;
    const ins = [
      [K('Emergency stop circuit'), st(!m.estop, 'Closed|circuit', 'Open|circuit', 'on')], [K('Parking brake switch'), st(m.parkBrake, 'Applied|park', 'Released|park')],
      [K('Brake pedal switch'), st(m.pedal, 'Pressed', 'Released|pedal')], [K('Drive lever'), `<span class="pill on">${m.dir}</span>`],
      [K('Operator seat switch'), st(true, 'Seated', 'Seated')], [K('Leg lower limits'), `<span class="pill ${legsDownCount() ? 'on' : 'off'}">${tx('{0} / 4 closed', legsDownCount())}</span>`],
      [K('Regeneration switch'), st(S.regen.inhibit, 'Inhibit|state', 'Permit|state', 'warn')], [K('Ignition'), st(m.engineOn, 'On|ignition', 'Off|ignition')],
    ];
    const outsL = [
      [K('Drive pump, forward'), `<b class="num" style="font-size:22px"><span data-live="pumpF"></span> mA</b>`], [K('Drive pump, reverse'), `<b class="num" style="font-size:22px"><span data-live="pumpR"></span> mA</b>`],
      [K('Free circulation valve'), st(!!outs.freeCirc || S.bt.phase === 'running', 'Active', 'Off|valve', 'acc')], [K('Accumulator relief Y295B'), st(!!outs.relief, 'Active', 'Off|valve', 'acc')],
      [K('Service brake circuit 2 Y192B'), st(!!outs.brake2, 'Active', 'Off|valve', 'acc')], [K('Leg valves'), st(legsMoving(), 'Moving', 'Off|valve', 'acc')],
      [K('Work lights'), st(!!outs.lights || m.engineOn, 'On|light', 'Off|light')], [K('Beacon'), st(!!outs.beacon || m.speed > 0, 'On|light', 'Off|light')],
    ];
    body = `<div style="display:flex;gap:20px;flex:1;min-height:0">
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:10px"><div class="card-h"><h2>${tx('Inputs')}</h2><span class="mut" style="font-size:15px">${tx('Live')}</span></div><div class="kv" style="grid-template-columns:1fr">${ins.map(([l, c]) => `<div><span>${tx(l)}</span>${c}</div>`).join('')}</div></section>
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:10px"><div class="card-h"><h2>${tx('Outputs')}</h2><button class="btn sm" data-act="svcOpen" data-arg="outputs">${S.access < 2 ? I.lock : ''}${tx('Test outputs')}</button></div><div class="kv" style="grid-template-columns:1fr">${outsL.map(([l, c]) => `<div><span>${tx(l)}</span>${c}</div>`).join('')}</div></section></div>`;
  } else if (S.diag === 'net') {
    const n = S.net; const sel = MODULES.find((x) => x.id === n.sel) || MODULES[0];
    const done = n.phase === 'done';
    body = `<div style="display:flex;gap:20px;flex:1;min-height:0">
      <section class="card pad" style="flex:1.2;display:flex;flex-direction:column;gap:8px">
        <div class="card-h" style="align-items:center"><h2>${tx('Modules on the bus')}</h2><button class="btn sm ${n.phase === 'running' ? '' : 'pri'}" data-act="netRun" ${n.phase === 'running' ? 'disabled' : ''}>${tx(n.phase === 'running' ? 'Checking…' : done ? 'Check again' : 'Run network check')}</button></div>
        ${n.phase === 'running' ? `<div class="progress"><div data-w="net"></div></div>` : done ? `<p class="mini" style="color:var(--txt2)">${tx('9 of 10 modules answered. The wireless remote is not paired. It is optional.')}</p>` : `<p class="mini">${tx('Run a check to ping every module and read its error counters.')}</p>`}
        <div style="display:flex;flex-direction:column;gap:6px;overflow:auto">${MODULES.map((x) => `<button class="mod ${x.id === sel.id ? 'sel' : ''}" data-act="netSel" data-arg="${x.id}"><span class="mn">${tx(x.n)}</span><span class="mono mut" style="font-size:13px">${tx('node {0}', x.node)}</span><span class="pill ${x.st === 'ok' ? 'ok' : 'off'}">${tx(x.st === 'ok' ? 'Online' : 'Not paired')}</span></button>`).join('')}</div>
      </section>
      <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:12px">
        <div class="card-h"><h2>${tx(sel.n)}</h2></div>
        <table class="table"><tbody>
          <tr><td>${tx('Status')}</td><td class="r">${tx(sel.st === 'ok' ? 'Operational' : 'Not paired')}</td></tr>
          <tr><td>${tx('Node ID')}</td><td class="r mono">${sel.node}</td></tr>
          <tr><td>${tx('Software')}</td><td class="r mono">${sel.fw}</td></tr>
          <tr><td>${tx('Bus')}</td><td class="r">CAN 1 · 250 kbit/s</td></tr>
          <tr><td>${tx('Error frames, last hour')}</td><td class="r">${sel.st === 'ok' && done ? '0' : '–'}</td></tr>
          <tr><td>${tx('Bus load')}</td><td class="r">${S.lang === 'tr' ? '%<span data-live="busload"></span>' : '<span data-live="busload"></span> %'}</td></tr>
        </tbody></table>
        <p class="mini">${tx('Example data. Version numbers do not match a real machine.')}</p>
      </section></div>`;
  } else {
    body = brakeTestBody();
  }
  return `<main class="main"><div class="col" style="flex:1;gap:14px">
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${S.diag === k ? 'on' : ''}" aria-selected="${S.diag === k}" data-act="diag" data-arg="${k}">${tx(l)}</button>`).join('')}</div>
    ${body}</div></main>`;
}
function brakeTestBody() {
  const b = S.bt; const checks = btChecks(); const ok = checks.every((c) => c.ok) && b.area;
  let right;
  if (b.phase === 'setup') {
    right = `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px">
      ${checks.map((c) => `<li class="check ${c.ok ? '' : 'bad'}"><span class="${c.ok ? 'okdot' : 'baddot'}"></span><span class="ct">${esc(c.l)}${c.hint && !c.ok ? `<small>${esc(c.hint)}</small>` : ''}</span><span class="cv">${esc(c.v)}</span></li>`).join('')}
      <li class="check ${b.area ? '' : 'bad'}"><span class="${b.area ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('Area in front of the machine is clear')}<small>${tx('The machine may move if a brake fails.')}</small></span><button class="btn sm ${b.area ? '' : 'pri'}" data-act="btArea" style="min-width:132px">${tx(b.area ? 'Confirmed' : 'I checked')}</button></li></ul>
      <div style="flex:1"></div>
      <button class="btn ${ok ? 'go' : ''} block" data-act="btStart" ${ok ? '' : 'disabled'} style="min-height:66px;font-size:20px">${ok ? I.play + tx('Start 5 second brake test') : tx('Complete the checks to start')}</button>`;
  } else if (b.phase === 'running') {
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:18px;justify-content:center">
      <div style="font-size:22px;font-weight:700;color:var(--accent)">${tx('Test running · keep the pedal pressed')}</div>
      <div class="progress"><div data-w="bt"></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
        <div class="stat"><div class="k">${tx('Time')}</div><div class="v"><span data-live="btT"></span><small> ${tu('s')}</small></div></div>
        <div class="stat"><div class="k">${tx('Distance moved')}</div><div class="v"><span data-live="btDist"></span><small> cm</small></div></div>
        <div class="stat"><div class="k">${tx('Engine')}</div><div class="v"><span data-live="rpm"></span><small> ${tu('rpm')}</small></div></div>
      </div>
      <p class="mini">${tx('Engine pulls against the service brakes. Release the pedal in the reviewer panel to see a failed test.')}</p></div>`;
  } else {
    const pass = b.phase === 'pass';
    const reason = b.reason === 'engine' ? tx('The engine stopped during the test.') : b.reason === 'moved' ? tx('The machine moved {0} cm. The brakes did not hold.', f0(b.dist)) : '';
    right = `<div style="flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center">
      <div style="display:flex;align-items:center;gap:14px"><span style="width:56px;height:56px;color:${pass ? 'var(--ok)' : 'var(--redTxt)'}">${pass ? I.okc : I.xc}</span><div><h2 style="margin:0;font-size:30px">${tx(pass ? 'Brake test passed' : 'Brake test failed')}</h2><p class="mini" style="font-size:16px">${pass ? tx('The machine held still for 5 seconds.') : esc(reason)}</p></div></div>
      <table class="table"><tbody>
        <tr><td>${tx('Distance moved')}</td><td class="r">${f0(b.dist)} cm</td></tr>
        <tr><td>${tx('Brake circuit 1, max')}</td><td class="r">${f0(b.max1)} bar</td></tr>
        <tr><td>${tx('Brake circuit 2, max')}</td><td class="r">${f0(b.max2)} bar</td></tr>
        <tr><td>${tx('Accumulator charge')}</td><td class="r">${f0(S.m.acc)} bar</td></tr>
      </tbody></table>
      <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="btReset">${tx('Run again')}</button><button class="btn ${b.saved ? '' : 'pri'}" style="flex:1" data-act="btSave" ${b.saved ? 'disabled' : ''}>${tx(b.saved ? 'Report saved' : 'Save report')}</button></div></div>`;
  }
  return `<div style="display:flex;gap:20px;flex:1;min-height:0">
    <section class="card pad" style="width:420px;flex:none;display:flex;flex-direction:column;gap:10px">
      <div class="card-h"><h2>${tx('Brake pressures')}</h2><span class="mut" style="font-size:15px">${tx('Live')}</span></div>
      <div class="kv" style="grid-template-columns:1fr">
        <div><span>${tx('Accumulator charge')}</span><b class="num" style="font-size:24px"><span data-live="g:acc"></span> bar</b></div>
        <div><span>${tx('Warning level')}</span><b class="num" style="font-size:24px">130 bar</b></div>
        <div><span>${tx('Alarm level')}</span><b class="num" style="font-size:24px">115 bar</b></div>
        <div><span>${tx('Service brake circuit 1')}</span><b class="num" style="font-size:24px"><span data-live="g:b1"></span> bar</b></div>
        <div><span>${tx('Service brake circuit 2')}</span><b class="num" style="font-size:24px"><span data-live="g:b2"></span> bar</b></div>
        <div><span>${tx('Low pressure switches')}</span><span class="pill ok">${tx('OK')}</span></div>
      </div>
      <p class="mini">${tx('Opened with the Brake TEST key in the cab, or from here.')}</p>
    </section>
    <section class="card pad" style="flex:1;display:flex;flex-direction:column;gap:12px">
      <div class="card-h"><h2>${tx('Service brake test')}</h2>${S.reports.length ? `<span class="mut" style="font-size:15px">${tx(S.reports.length > 1 ? '{0} reports saved' : '{0} report saved', S.reports.length)}</span>` : ''}</div>
      ${right}
    </section></div>`;
}

/* ---------- Service ---------- */
const DIR = [
  { g: K('Logs and data'), items: [
    { l: K('Alarm log'), k: 'alarm history log alerts', act: 'alertHistory' },
    { l: K('Operating hours'), k: 'hours usage time distance energy fuel', p: 'hours' },
    { l: K('Copy data to USB'), k: 'usb export drive usage data report', p: 'usb:data' },
    { l: K('Version info'), k: 'software firmware version', p: 'version' }] },
  { g: K('Display'), items: [
    { l: K('Brightness'), k: 'screen dim backlight', p: 'display' }, { l: K('Day / night'), k: 'theme dark light mode', p: 'display' },
    { l: K('Language'), k: 'language english turkish türkçe', p: 'display' }, { l: K('Time'), k: 'clock time zone utc offset', p: 'display' }] },
  { g: K('Calibration'), items: [
    { l: K('Boom'), k: 'boom sensor calibration', p: 'calib:boom', lvl: 2 }, { l: K('Joysticks'), k: 'joystick calibration', p: 'calib:joy', lvl: 2 },
    { l: K('Pedals'), k: 'pedal accelerator calibration', p: 'calib:pedal', lvl: 2 }, { l: K('Brake circuit'), k: 'brake test circuit', act: 'brakeTest' },
    { l: K('Outputs'), k: 'output test valve light', p: 'outputs', lvl: 2 }] },
  { g: K('Engine and drivetrain'), items: [
    { l: K('Engine'), k: 'idle rpm engine speed', p: 'params:engine' }, { l: K('Hydrostatic drive'), k: 'pump current ma drive ramp', p: 'params:hydro' },
    { l: K('Auto gears'), k: 'gear shift maximum', p: 'params:gears' }, { l: K('Retarder'), k: 'retarder brake', p: 'params:retarder' },
    { l: K('Suspension'), k: 'suspension ride height damping', p: 'params:susp' }] },
  { g: K('Diagnostics'), items: [
    { l: K('Diesel engine'), k: 'engine diesel soot', act: 'diagGo', arg: 'engine' }, { l: K('Module I/O'), k: 'input output io', act: 'diagGo', arg: 'io' },
    { l: K('Network'), k: 'can bus network module', act: 'diagGo', arg: 'net' }, { l: K('Brake test'), k: 'brake test', act: 'brakeTest' },
    { l: K('Cameras'), k: 'camera view', act: 'camera' }] },
  { g: K('System'), items: [
    { l: K('Access level'), k: 'login password code access', act: 'login' }, { l: K('Backup'), k: 'backup usb', p: 'usb:backup', lvl: 2 },
    { l: K('Update'), k: 'update software usb', p: 'usb:update', lvl: 2 }, { l: K('Change history'), k: 'history undo parameter log', p: 'history' },
    { l: K('Serial no.'), k: 'serial number', p: 'params:system', lvl: 3 }, { l: K('Factory defaults'), k: 'factory reset defaults', p: 'defaults', lvl: 3 }] },
];
const trLower = (s) => s.toLocaleLowerCase(S.lang === 'tr' ? 'tr-TR' : 'en-US');
function renderDir() {
  const q = trLower(S.svc.q.trim());
  let hits = 0;
  const html = DIR.map((g, gi) => {
    const items = g.items.map((it, ii) => ({ it, ii })).filter(({ it }) => {
      if (!q) return true;
      const hay = trLower([it.l, it.k || '', g.g, tx(it.l), tx(g.g)].join(' '));
      return hay.includes(q);
    });
    hits += items.length;
    if (!items.length) return '';
    return `<div class="dgrp"><span style="font-size:17px;font-weight:600">${tx(g.g)}</span><div class="items">${items.map(({ it, ii }) => {
      const locked = (it.lvl || 0) > S.access; const sel = it.p && S.svc.panel === it.p;
      return `<button class="ditem ${locked ? 'locked' : ''} ${sel ? 'sel' : ''}" data-act="svcItem" data-arg="${gi}:${ii}">${locked ? I.lock : ''}${tx(it.l)}</button>`;
    }).join('')}</div></div>`;
  }).join('');
  return hits ? html : `<div class="empty" style="grid-column:1/-1">${esc(tx('No match for “{0}”.', S.svc.q))}<button class="btn sm" data-act="svcClearQ">${tx('Clear search')}</button></div>`;
}
function svcPanel() {
  const s = S.svc; const p = s.panel;
  const head = (crumb, title) => `<div style="display:flex;align-items:center;gap:10px"><button class="tbtn" data-act="svcHome" aria-label="${esc(tx('Back to overview'))}">${I.back}</button><div><div class="mut" style="font-size:14px">${esc(crumb)}</div><h2 style="margin:0;font-size:24px;line-height:1.2">${esc(title)}</h2></div></div>`;
  if (p === 'home') {
    const recent = S.phist.slice(-3).reverse();
    return `<div class="card-h"><h2>${tx('Service overview')}</h2><span class="pill ${S.access ? 'acc' : 'off'}">${lvlName(S.access)}</span></div>
      <div style="background:var(--panel2);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Next service')}</span><span style="font-size:20px;font-weight:600">${tx('Engine oil and filters')}</span><span class="mini">${tx('Due in {0} · every 250 engine hours (example interval)', `<b style="color:var(--txt)">69 ${tu('h')}</b>`)}</span></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Recent parameter changes')}</span>
        ${recent.length ? recent.map((h) => `<div class="kv" style="grid-template-columns:1fr"><div><span>${esc(histName(h))}</span><span class="mono" style="font-size:14px">${h.old} → ${h.nw} ${esc(tu(h.unit))} · ${hhmm(h.t)}</span></div></div>`).join('') : `<p class="mini">${tx('None this session. Open Engine and drivetrain to change one.')}</p>`}
      </div>
      <div style="flex:1"></div>
      <div style="display:flex;gap:10px">${S.access ? `<button class="btn" style="flex:1" data-act="logout">${tx('Log out')}</button>` : `<button class="btn pri" style="flex:1" data-act="login">${I.key}${tx('Log in for maintenance')}</button>`}<button class="btn" style="flex:1" data-act="svcOpen" data-arg="history">${tx('Change history')}</button></div>`;
  }
  if (p.startsWith('params:')) {
    const gk = p.split(':')[1]; const g = PARAMS[gk];
    const cur = s.param && g.items.find((x) => x.id === s.param);
    const crumb = gk === 'system' ? tx('System') : tx('Engine and drivetrain');
    if (!cur) {
      return `${head(crumb, tx(g.title))}
        <div style="display:flex;flex-direction:column;gap:8px">${g.items.map((x) => `<button class="prow" data-act="pSel" data-arg="${x.id}"><span class="pn">${tx(x.name)}<small>${esc(tx('Range {0}–{1} {2} · default {3}', x.min, x.max, tu(x.unit), x.def))}</small></span><span class="num pv">${withUnit(PV[x.id], x.unit).replace(/ (\S+)$/, ' <small class="mut" style="font:500 15px Barlow">$1</small>')}</span></button>`).join('')}</div>
        <div style="flex:1"></div><p class="mini">${tx('Everyone can view parameters. Changing them needs {0} level.', lvlName(g.items[0].level || 2))}</p>`;
    }
    const lvl = cur.level || 2;
    const u = tu(cur.unit);
    const intro = `${head(tx(g.title), tx(cur.name))}<div style="display:flex;gap:10px;font-size:15px;color:var(--mut);flex-wrap:wrap"><span>${tx('Now')} <b style="color:var(--txt)">${withUnit(PV[cur.id], cur.unit)}</b></span><span>·</span><span>${tx('Range')} ${cur.min}–${cur.max} ${u}</span><span>·</span><span>${tx('Default')} ${withUnit(cur.def, cur.unit)}</span></div>`;
    if (s.mode === 'view') {
      return `${intro}<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px"><span class="num" style="font-size:96px;line-height:1">${PV[cur.id]}</span><span class="mut" style="font-size:20px">${u || '&nbsp;'}</span></div>
        <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="pList">${tx('All values')}</button><button class="btn pri" style="flex:1.3" data-act="pEdit">${S.access < lvl ? I.lock + tx('Log in to change') : tx('Change value')}</button></div>`;
    }
    const n = s.entry === '' ? NaN : parseInt(s.entry, 10);
    const okR = !isNaN(n) && n >= cur.min && n <= cur.max; const changed = okR && n !== PV[cur.id];
    if (s.mode === 'edit') {
      let msg = '', mc = 'var(--mut)';
      if (s.entry === '') msg = tx('Type a value between {0} and {1}.', cur.min, cur.max);
      else if (!okR) { msg = tx('Out of range. Allowed {0}–{1} {2}.', cur.min, cur.max, u); mc = 'var(--redTxt)'; }
      else if (!changed) msg = tx('Same as the current value.');
      else { msg = tx('1 unsaved change: {0} → {1} {2} ({3})', PV[cur.id], n, u, (n > PV[cur.id] ? '+' : '') + (n - PV[cur.id])); mc = 'var(--amberTxt)'; }
      return `${intro}
        <div class="entry ${s.entry !== '' && !okR ? 'bad' : changed ? 'chg' : ''}"><span class="mut" style="font-size:15px">${tx('New value')}</span><span class="num">${s.entry === '' ? '–' : esc(s.entry)} <small class="mut" style="font:500 18px Barlow">${u}</small></span></div>
        <div style="font-size:15px;color:${mc};min-height:20px">${esc(msg)}</div>
        <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => `<button data-act="key" data-arg="${k}">${k}</button>`).join('')}<button data-act="keyClr" style="font-size:18px">${tx('Clear|keypad')}</button><button data-act="key" data-arg="0">0</button><button data-act="keyDel" aria-label="${esc(tx('Delete last digit'))}">⌫</button></div>
        <div style="flex:1"></div>
        <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="pCancel">${tx('Cancel')}</button><button class="btn pri" style="flex:1.4" data-act="pReview" ${changed ? '' : 'disabled'}>${tx('Review and save')}</button></div>`;
    }
    return `${intro}<div style="flex:1;display:flex;flex-direction:column;gap:16px;justify-content:center">
      <div style="font-size:20px;font-weight:600">${tx('Save this change?')}</div>
      <div style="display:grid;grid-template-columns:1fr 40px 1fr;align-items:center;background:var(--panel2);border-radius:12px;padding:18px;text-align:center">
        <div><div class="mut" style="font-size:14px">${tx('Before')}</div><div class="num mut" style="font-size:42px;text-decoration:line-through">${PV[cur.id]}</div></div><div class="mut" style="font-size:26px">→</div>
        <div><div class="mut" style="font-size:14px">${tx('After')}</div><div class="num" style="font-size:42px">${n}</div></div></div>
      <ul style="margin:0;padding-left:22px;font-size:16px;line-height:1.55;color:var(--txt2)"><li>${tx('Takes effect straight away in this demo.')}</li><li>${tx('Logged with your access level and the time.')}</li><li>${tx('Undo any time from Change history.')}</li></ul></div>
      <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="pBack">${tx('Back')}</button><button class="btn go" style="flex:1.4" data-act="pSave">${tx('Save 1 change')}</button></div>`;
  }
  if (p === 'history') {
    return `${head(tx('System'), tx('Change history'))}
      <div style="flex:1;overflow:auto">${S.phist.length ? `<table class="table"><thead><tr><th>${tx('Time')}</th><th>${tx('Parameter')}</th><th class="r">${tx('Change')}</th><th>${tx('By')}</th><th></th></tr></thead><tbody>${S.phist.slice().reverse().map((h) => `<tr><td>${hhmm(h.t)}</td><td>${esc(histName(h))}</td><td class="r mono" style="font-size:14px">${h.old} → ${h.nw} ${esc(tu(h.unit))}</td><td>${esc(lvlName(h.by))}</td><td class="r">${h.undone ? `<span class="mut" style="font-size:14px">${tx('Undone')}</span>` : `<button class="btn sm" data-act="undo" data-arg="${h.i}">${I.undo}${tx('Undo')}</button>`}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${tx('No changes yet. Change a parameter and it shows up here with an Undo button.')}</div>`}</div>`;
  }
  if (p === 'hours') {
    return `${head(tx('Logs and data'), tx('Operating hours'))}
      <table class="table"><tbody>
        <tr><td>${tx('Engine hours')}</td><td class="r"><span data-live="hours"></span> ${tu('h')}</td></tr>
        <tr><td>${tx('Driving hours')}</td><td class="r">1 204 ${tu('h')}</td></tr>
        <tr><td>${tx('Boom work hours')}</td><td class="r">1 466 ${tu('h')}</td></tr>
        <tr><td>${tx('Distance')}</td><td class="r"><span data-live="odo"></span> km</td></tr>
        <tr><td>${tx('Fuel used')}</td><td class="r">38 210 l</td></tr>
        <tr><td>${tx('Regenerations')}</td><td class="r">${S.regen.count}</td></tr>
      </tbody></table><p class="mini">${tx('Example figures except where they update live.')}</p><div style="flex:1"></div>
      <button class="btn pri" data-act="svcOpen" data-arg="usb:data">${I.usb}${tx('Copy drive and usage data to USB')}</button>`;
  }
  if (p === 'version') {
    return `${head(tx('Logs and data'), tx('Version info'))}
      <table class="table"><tbody>${MODULES.filter((x) => x.st === 'ok').map((x) => `<tr><td>${tx(x.n)}</td><td class="r mono" style="font-size:14px">${x.fw}</td></tr>`).join('')}<tr><td>${tx('Machine serial')}</td><td class="r mono" style="font-size:14px">${PV.serial}</td></tr></tbody></table>
      <p class="mini">${tx('Example version numbers only.')}</p>`;
  }
  if (p === 'display') {
    return `${head(tx('Display'), tx('Display settings'))}
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker" id="brightLbl">${esc(tx('Brightness · {0}', pct(S.bright)))}</span><input type="range" min="30" max="100" step="5" value="${S.bright}" data-input="bright" aria-label="${esc(tx('Brightness'))}" style="width:100%;height:44px;accent-color:var(--accent)"></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Mode')}</span><div class="tabs"><button class="${S.theme === 'night' ? 'on' : ''}" data-act="theme" data-arg="night">${tx('Night · underground')}</button><button class="${S.theme === 'day' ? 'on' : ''}" data-act="theme" data-arg="day">${tx('Day · bright light')}</button></div></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Language')}</span><div class="tabs">${LANGS.map(([k, l]) => `<button class="${S.lang === k ? 'on' : ''}" data-act="lang" data-arg="${k}" lang="${k}">${l}</button>`).join('')}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="kicker">${tx('Time · UTC offset')}</span><div style="display:flex;align-items:center;gap:12px"><button class="btn sm" data-act="tz" data-arg="-1" aria-label="${esc(tx('Minus one hour'))}">−1 ${tu('h')}</button><span class="num" style="font-size:30px;min-width:120px;text-align:center">${S.tz >= 0 ? '+' : ''}${S.tz} ${tu('h')}</span><button class="btn sm" data-act="tz" data-arg="1" aria-label="${esc(tx('Plus one hour'))}">+1 ${tu('h')}</button><span class="mut" style="font-size:16px">${tx('Clock shows')} <b data-live="clock" style="color:var(--txt)"></b></span></div></div>`;
  }
  if (p.startsWith('usb:')) {
    const kind = p.split(':')[1]; const u = s.usb || (s.usb = { kind, phase: 'prep', inserted: false, p: 0 });
    const TITLE = { data: K('Copy drive and usage data'), alerts: K('Save alerts to USB'), backup: K('Full system backup'), update: K('Software update') };
    const est = S.m.estop;
    if (u.phase === 'prep') {
      const ok = est && u.inserted;
      return `${head('USB', tx(TITLE[kind]))}
        <p class="mini" style="font-size:16px">${tx('USB work needs the emergency stop pressed first, so nothing can move while files are written.')}</p>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px">
          <li class="check ${est ? '' : 'bad'}"><span class="${est ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('Emergency stop pressed')}<small>${tx(est ? 'Pressed.' : 'Use Emergency stop in the reviewer panel.')}</small></span></li>
          <li class="check ${u.inserted ? '' : 'bad'}"><span class="${u.inserted ? 'okdot' : 'baddot'}"></span><span class="ct">${tx('USB stick inserted')}<small>${u.inserted ? esc(tx('NORSMART_USB · {0} GB free', f1(7.4))) : tx('Port is behind the seat.')}</small></span>${u.inserted ? '' : `<button class="btn sm pri" data-act="usbInsert" ${est ? '' : 'disabled'}>${I.usb}${tx('Insert stick')}</button>`}</li>
        </ul><div style="flex:1"></div>
        <button class="btn ${ok ? 'go' : ''} block" data-act="usbStart" ${ok ? '' : 'disabled'}>${tx(kind === 'update' ? 'Start update' : 'Start')}</button>`;
    }
    if (u.phase === 'countdown') {
      return `${head('USB', tx(TITLE[kind]))}<div style="flex:1;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;text-align:center">
        <span class="num" style="font-size:96px;line-height:1" data-live="usbT"></span><span style="font-size:20px">${tx('Update starts automatically')}</span>
        <p class="mini">${tx('Remove the stick now to cancel. The real system waits 30 s. The demo waits 10 s.')}</p></div>
        <button class="btn danger block" data-act="usbCancel">${tx('Remove stick and cancel')}</button>`;
    }
    if (u.phase === 'working') {
      return `${head('USB', tx(TITLE[kind]))}<div style="flex:1;display:flex;flex-direction:column;gap:14px;justify-content:center">
        <span style="font-size:20px;font-weight:600">${tx(kind === 'update' ? 'Updating modules… do not switch off' : 'Writing to USB…')}</span><div class="progress"><div data-w="usb"></div></div></div>`;
    }
    const DONE = { data: K('Data copied'), alerts: K('Alerts saved'), backup: K('Backup written'), update: K('Update installed') };
    return `${head('USB', tx(TITLE[kind]))}<div style="flex:1;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;text-align:center">
      <span style="width:60px;height:60px;color:var(--ok)">${I.okc}</span><span style="font-size:22px;font-weight:600">${tx(DONE[kind])}</span>
      <p class="mini">${kind === 'update' ? tx('Restart the machine to finish.') : kind === 'backup' ? esc(tx('backup_{0}.tar is on the stick. Remove the stick and release the emergency stop.', PV.serial)) : tx('Remove the stick and release the emergency stop.')}</p></div>
      ${kind === 'update' ? `<button class="btn go block" data-act="restart">${tx('Restart now')}</button>` : `<button class="btn pri block" data-act="usbDone">${tx('Done')}</button>`}`;
  }
  if (p.startsWith('calib:')) {
    const kind = p.split(':')[1]; const c = s.calib && s.calib.kind === kind ? s.calib : (s.calib = { kind, step: 0, cap: [] });
    const NAMES = { boom: [K('Boom lift sensor'), K('Lower the boom fully'), K('Set the boom level'), K('Raise the boom fully')], joy: [K('Right joystick, forward axis'), K('Pull the joystick fully back'), K('Let it return to centre'), K('Push it fully forward')], pedal: [K('Drive pedal'), K('Release the pedal fully'), K('Press it halfway'), K('Press it fully down')] }[kind];
    const steps = NAMES.slice(1);
    const STEPN = [K('Minimum'), K('Centre'), K('Maximum')];
    const SHORT = [K('Min'), K('Centre'), K('Max')];
    const CAP = [K('Capture minimum'), K('Capture centre'), K('Capture maximum')];
    if (c.step < 3) {
      return `${head(tx('Calibration'), tx(NAMES[0]))}
        <div style="display:flex;gap:8px">${steps.map((x, i) => `<span class="pill ${i < c.step ? 'ok' : i === c.step ? 'acc' : 'off'}" style="flex:1;justify-content:center;height:34px">${i + 1}. ${tx(STEPN[i])}</span>`).join('')}</div>
        <div style="font-size:22px;font-weight:600;margin-top:6px">${esc(tx('{0}, then tap {1}.', tx(steps[c.step]), tx('Capture')))}</div>
        <div><div class="card-h mut" style="font-size:15px;margin-bottom:6px"><span>${tx('Live sensor')}</span><span><b class="num" style="font-size:24px;color:var(--txt)" data-live="sensor"></b> mA</span></div><div class="track" style="height:18px"><div class="fill" data-w="sensor" style="background:var(--accent);transition:none"></div></div></div>
        <div class="kv" style="grid-template-columns:repeat(3,1fr)">${SHORT.map((l, i) => `<div><span>${tx(l)}</span><b class="num" style="font-size:22px">${c.cap[i] != null ? f1(c.cap[i]) + ' mA' : '–'}</b></div>`).join('')}</div>
        <div style="flex:1"></div>
        <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="calRedo">${tx('Start over')}</button><button class="btn pri" style="flex:1.4" data-act="calCap">${tx(CAP[c.step])}</button></div>`;
    }
    const okc = c.cap[0] < c.cap[1] && c.cap[1] < c.cap[2];
    return `${head(tx('Calibration'), tx(NAMES[0]))}
      <div class="kv" style="grid-template-columns:repeat(3,1fr)">${SHORT.map((l, i) => `<div><span>${tx(l)}</span><b class="num" style="font-size:22px">${f1(c.cap[i])} mA</b></div>`).join('')}</div>
      <div class="check ${okc ? '' : 'bad'}"><span class="${okc ? 'okdot' : 'baddot'}"></span><span class="ct">${tx(okc ? 'Values are in order and spread enough.' : 'Values are out of order. Start over and follow the steps.')}</span></div>
      <div style="flex:1"></div>
      <div style="display:flex;gap:10px"><button class="btn" style="flex:1" data-act="calRedo">${tx('Start over')}</button><button class="btn go" style="flex:1.4" data-act="calSave" ${okc ? '' : 'disabled'}>${tx('Save calibration')}</button></div>`;
  }
  if (p === 'outputs') {
    const OUTS = [['lights', K('Work lights')], ['beacon', K('Beacon')], ['horn', K('Horn')], ['freeCirc', K('Free circulation valve')], ['relief', K('Accumulator relief Y295B')], ['brake2', K('Service brake circuit 2 Y192B')]];
    return `${head(tx('Calibration'), tx('Output test'))}
      <p class="mini" style="font-size:16px">${tx('Each test switches the output on for 2 seconds. Valve tests need the parking brake on.')}</p>
      <div style="display:flex;flex-direction:column;gap:8px">${OUTS.map(([k, l]) => { const on = S.outputs[k] > now(); return `<div class="prow"><span class="pn">${tx(l)}</span><span class="pill ${on ? 'acc' : 'off'}">${tx(on ? 'On|output' : 'Off|output')}</span><button class="btn sm" data-act="outTest" data-arg="${k}" ${on ? 'disabled' : ''}>${tx('Test {0}', '2 ' + tu('s'))}</button></div>`; }).join('')}</div>`;
  }
  if (p === 'defaults') {
    return `${head(tx('System'), tx('Factory defaults'))}
      <p style="font-size:17px;line-height:1.45;color:var(--txt2);margin:0">${tx('Puts every engine and drivetrain parameter back to its factory value. Calibrations and logs are kept. Each reset value is written to Change history, so it can be undone.')}</p>
      <div style="flex:1"></div><button class="btn danger block" data-act="defaultsAsk">${tx('Restore factory defaults')}</button>`;
  }
  return '';
}
const histName = (h) => { const f = findParam(h.id); const nm = f ? tx(f.p.name) : h.id; return h.isUndo ? nm + ' ' + tx('(undo)') : nm; };
function scrService() {
  return `<main class="main">
    <section class="col" style="width:620px;flex:none;gap:14px" aria-label="${esc(tx('Service directory'))}">
      <label class="search">${I.search}<span class="sr">${tx('Search service functions')}</span><input id="svcSearch" type="search" placeholder="${esc(tx('Search: pump current, brake test, language…'))}" value="${esc(S.svc.q)}" autocomplete="off">${S.svc.q ? `<button class="tbtn" data-act="svcClearQ" aria-label="${esc(tx('Clear search'))}">${I.close}</button>` : ''}</label>
      <div class="dir" id="svcDir">${renderDir()}</div>
    </section>
    <section class="card" style="flex:1;min-width:0;padding:18px 22px;display:flex;flex-direction:column;gap:14px" aria-label="${esc(tx('Service detail'))}">${svcPanel()}</section>
  </main>`;
}

/* ---------- overlays ---------- */
function overlays() {
  let h = '';
  const md = S.modal;
  if (md) {
    let inner = '';
    if (md.type === 'alarm') {
      const a = byId(md.id);
      if (a) {
        inner = `<div class="dialog alarm" role="alertdialog" aria-modal="true" aria-label="${esc(tx('Alarm'))}">
          <div style="display:flex;align-items:center;gap:12px"><span class="sev alarm">!</span><span class="pill alarm">${tx('Alarm')}</span><span class="mono mut" style="font-size:14px">${esc(tx('Code {0} · {1}', a.def.code, tx(a.def.src)))}</span></div>
          <h2>${esc(tf(a.def.title))}</h2><p>${esc(tf(a.def.what))}</p>
          <div><div class="kicker" style="margin-bottom:6px">${tx('Do this first')}</div><p style="font-size:20px;color:var(--txt)">${esc(tf(a.def.steps[0]))}</p></div>
          <div class="acts"><button class="btn" data-act="mView" data-arg="${a.id}">${tx('See all steps')}</button><button class="btn pri" data-act="mAck" data-arg="${a.id}">${tx('Acknowledge')}</button></div></div>`;
      }
    } else if (md.type === 'login') {
      const lv = md.sel;
      inner = `<div class="dialog wide" role="dialog" aria-modal="true" aria-label="${esc(tx('Access level'))}">
        <div class="card-h"><h2>${tx('Access level')}</h2><button class="tbtn" data-act="close" aria-label="${esc(tx('Close'))}">${I.close}</button></div>
        <p>${md.need ? esc(tx('This needs {0} level or higher.', lvlName(md.need))) : esc(tx('You are {0}. Pick a level and enter its code. You are logged out after 15 minutes.', lvlName(S.access)))}</p>
        <div class="lvlgrid">${LEVELS.map((L, i) => `<button class="lvl ${lv === i ? 'sel' : ''}" data-act="lvlSel" data-arg="${i}" ${md.need && i < md.need ? 'disabled style="opacity:.45"' : ''}><b>${tx(L.name)}</b><small>${tx(L.desc)}</small></button>`).join('')}</div>
        ${lv > 0 ? `<div style="display:flex;gap:20px;align-items:stretch">
          <div style="flex:1;display:flex;flex-direction:column;gap:10px;justify-content:center">
            <div class="entry ${md.err ? 'bad' : ''}" style="justify-content:center;align-items:center;gap:18px">${[0, 1, 2, 3].map((i) => `<span style="width:22px;height:22px;border-radius:11px;${i < md.code.length ? 'background:var(--txt)' : 'border:2px solid var(--line3)'}"></span>`).join('')}</div>
            <div style="min-height:22px;font-size:16px;color:${md.err ? 'var(--redTxt)' : 'var(--mut)'}">${tx(md.err ? 'Wrong code. Try again. Demo codes are in the reviewer panel.' : 'Enter the 4 digit code, or use a login key.')}</div>
          </div>
          <div class="keypad" style="width:330px">${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => `<button data-act="lkey" data-arg="${k}">${k}</button>`).join('')}<button data-act="lclr" style="font-size:18px">${tx('Clear|keypad')}</button><button data-act="lkey" data-arg="0">0</button><button data-act="ldel" aria-label="${esc(tx('Delete last digit'))}">⌫</button></div>
        </div>` : ''}
        <div class="acts"><button class="btn" data-act="close">${tx('Cancel')}</button>${S.access ? `<button class="btn" data-act="logout">${tx('Log out')}</button>` : ''}<button class="btn pri" data-act="doLogin" ${lv > 0 && md.code.length < 4 ? 'disabled' : ''}>${tx(lv === 0 ? 'Use Operator level' : 'Log in')}</button></div></div>`;
    } else if (md.type === 'ind') {
      const all = INDS.map((i) => ({ ...i, st: i.s(S.m) })).sort((a, b) => (a.st ? SEVRANK[a.st] : 9) - (b.st ? SEVRANK[b.st] : 9));
      inner = `<div class="dialog wide" role="dialog" aria-modal="true" aria-label="${esc(tx('All indicators'))}" style="max-height:740px">
        <div class="card-h"><h2>${tx('All indicators')}</h2><button class="tbtn" data-act="close" aria-label="${esc(tx('Close'))}">${I.close}</button></div>
        <p>${tx('Lit lamps first. Each one has a name, so nobody has to learn a symbol table.')}</p>
        <div class="indgrid">${all.map((i) => `<div class="indcell ${i.st ? 'on-' + i.st : 'off'}"><span class="lamp"></span>${esc(tx(i.l))}</div>`).join('')}</div>
        <div class="acts"><button class="btn pri" data-act="close">${tx('Close')}</button></div></div>`;
    } else if (md.type === 'confirm') {
      const title = tx(md.title); const text = tx(md.text, ...(md.args || []));
      inner = `<div class="dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><p>${esc(text)}</p>
        <div class="acts"><button class="btn" data-act="close">${tx('Cancel')}</button><button class="btn ${md.danger ? 'danger' : 'pri'}" data-act="confirmOk">${esc(tx(md.ok))}</button></div></div>`;
    }
    if (inner) h += `<div class="overlay">${inner}</div>`;
  }
  if (S.cam) {
    const v = S.cam;
    const CAMN = { rear: K('Rear camera'), front: K('Front camera'), boom: K('Boom camera') };
    const CAMS = { rear: K('Rear'), front: K('Front'), boom: K('Boom') };
    const lines = v === 'rear' ? `<i style="bottom:120px;background:#E0403A;left:150px;right:150px"></i><i style="bottom:260px;background:#F2A93B;left:220px;right:220px"></i><i style="bottom:380px;background:#4CC38A;left:280px;right:280px"></i>` : '';
    h += `<div class="cam" role="dialog" aria-label="${esc(tx('Camera view'))}"><div class="cam-view ${v}"><div class="noise"></div>
      <div class="rock" style="left:80px;top:120px;width:300px;height:220px"></div><div class="rock" style="right:120px;top:90px;width:340px;height:260px;background:#26251f"></div><div class="rock" style="left:420px;top:40px;width:420px;height:120px;background:#33312b"></div>
      <div class="cam-guide">${lines}</div>
      <span class="cam-tag">${tx(CAMN[v])} · ${tx('simulated')}</span><span class="cam-rec" data-live="clock"></span></div>
      <div class="cam-bar"><div class="tabs" style="flex:1;background:#15181C;border-color:#262C34">${['rear', 'front', 'boom'].map((k) => `<button class="${v === k ? 'on' : ''}" data-act="camera" data-arg="${k}" style="${v === k ? 'background:#E8EAED;color:#121417' : 'color:#B4BCC6'}">${tx(CAMS[k])}</button>`).join('')}</div>
      <button class="btn pri" data-act="camClose" style="background:#E8EAED;color:#121417;border-color:#E8EAED;min-width:220px">${I.close}${tx('Close camera')}</button></div></div>`;
  }
  if (S.toast) {
    h += `<div class="toast" role="status">${S.toast.kind === 'warn' ? `<span style="color:var(--amber)">${I.warn}</span>` : `<span style="color:var(--ok)">${I.check}</span>`}${esc(toastText())}</div>`;
  }
  if (S.boot) {
    const st = bootStep();
    const steps = [K('Checking modules on the bus'), K('Sending parameters to modules'), K('Modules operational')];
    h += `<div class="boot" role="status"><h2>${tx(S.boot.kind === 'update' ? 'Restarting after update' : 'Starting control system')}</h2>
      <div class="steps">${steps.map((s, i) => `<div class="step ${i < st ? 'done' : i === st ? 'now' : ''}">${i < st ? `<span style="width:22px;height:22px;color:#8FD3C7">${I.check}</span>` : i === st ? '<span class="spin"></span>' : '<span style="width:22px"></span>'}${tx(s)}</div>`).join('')}</div>
      <div class="progress"><div data-w="boot"></div></div>
      <button class="btn" data-act="bootSkip" style="color:#E8EAED;border-color:#3A424C">${tx('Skip')}</button></div>`;
  }
  h += `<div class="dimmer" style="opacity:${((100 - S.bright) / 100 * 0.75).toFixed(2)}"></div>`;
  return h;
}
const bootStep = () => { const e = now() - S.boot.t0; return e < 1400 ? 0 : e < 2800 ? 1 : e < 3800 ? 2 : 3; };

/* ================= render + live ================= */
const screenEl = $('#screen');
const SCR = { drive: scrDrive, exhaust: scrExhaust, alerts: scrAlerts, machine: scrMachine, engine: scrEngine, service: scrService };
let lastSig = '';
function render() {
  const focusSearch = document.activeElement && document.activeElement.id === 'svcSearch';
  const selStart = focusSearch ? document.activeElement.selectionStart : 0;
  screenEl.className = 'screen' + (S.theme === 'day' ? ' day' : '');
  screenEl.setAttribute('lang', S.lang);
  screenEl.innerHTML = topbar() + `<div class="body">${rail()}${SCR[S.screen]()}</div>` + overlays();
  if (focusSearch) { const i = $('#svcSearch'); if (i) { i.focus(); i.setSelectionRange(selStart, selStart); } }
  lastSig = sig();
  live();
  syncPanel();
}
function sig() {
  const m = S.m;
  return [
    S.lang, S.alerts.map((a) => a.id + (a.active ? 'a' : 'c') + (a.acked ? 'k' : '')).join(','),
    m.engineOn, m.dir, m.parkBrake, m.pedal, m.estop, m.legs.join(), S.legMove.map((x) => (x ? x.to : '-')).join(), m.block,
    dpfBand(), GAUGES.map(gState).join(), activeInds().map((i) => i.k + i.st).join(),
    S.regen.running, S.regen.done, regenChecks().map((c) => c.ok).join(), S.bt.phase, btChecks().map((c) => c.ok).join(),
    S.net.phase, S.svc.usb && S.svc.usb.phase, S.boot && bootStep(), S.toast && S.toast.until, S.access, m.exhaustT > 450,
    Object.keys(S.outputs).join(), S.modal && S.modal.type, readyChecks().map((c) => c.ok).join(),
  ].join('|');
}
const sensorV = () => { const c = S.svc.calib; const tgt = c && c.step < 3 ? [4.6, 12.1, 19.4][c.step] : 12; return tgt + 0.3 * Math.sin(now() / 430); };
const LIVE = {
  clock: () => hhmm(now()),
  sub: () => SUBTITLE[S.screen](),
  speed: () => f0(S.m.speed),
  gear: () => (S.m.dir === 'N' ? tx('Neutral') : tx('Gear {0}', S.m.gear)),
  gearSub: () => (S.m.dir === 'N' ? tx('Drive lever in N') : tx('Automatic · max {0}', S.m.dir === 'R' ? P('maxR') : P('maxF'))),
  rpm: () => f0(S.m.rpm),
  soot: () => f0(S.m.soot),
  odo: () => { const [i, d] = (Math.round(S.m.odo * 10) / 10).toFixed(1).split('.'); return f0(+i) + (S.lang === 'tr' ? ',' : '.') + d; },
  trip: () => f1(S.m.trip),
  hours: () => f0(Math.floor(S.m.hours)),
  battery: () => f1(S.m.battery),
  exhaustT: () => f0(S.m.exhaustT),
  load: () => f0(S.m.engineOn ? 18 + S.m.throttle * 70 + (S.regen.running ? 25 : 0) : 0),
  oilP: () => f1(S.m.engineOn ? 2.2 + S.m.rpm / 1000 : 0),
  oilT: () => f0(S.m.engineOn ? 92 + S.m.throttle * 6 : 50),
  boost: () => f1(S.m.engineOn ? 0.1 + S.m.throttle * 1.6 : 0),
  intake: () => f0(S.m.engineOn ? 38 + S.m.throttle * 12 : 20),
  fuelRate: () => f1(S.m.engineOn ? 2.4 + S.m.throttle * 18 + (S.regen.running ? 4 : 0) : 0),
  pumpF: () => f0(S.m.dir === 'F' && S.m.speed > 0 ? 200 + S.m.speed / 25 * (P('pumpFwd') - 200) : 0),
  pumpR: () => f0(S.m.dir === 'R' && S.m.speed > 0 ? 200 + S.m.speed / 15 * (P('pumpRev') - 200) : 0),
  busload: () => f0(31 + Math.sin(now() / 900) * 3),
  btT: () => f1(S.bt.t),
  btDist: () => f0(S.bt.dist),
  usbT: () => (S.svc.usb ? Math.ceil(S.svc.usb.t) : ''),
  sensor: () => f1(sensorV()),
};
const WIDTH = {
  rpm: () => clamp(S.m.rpm / 2600 * 100, 0, 100),
  soot: () => clamp(S.m.soot, 0, 100),
  regen: () => (S.regen.from > 6 ? clamp((S.regen.from - S.m.soot) / (S.regen.from - 6) * 100, 0, 100) : 0),
  bt: () => clamp(S.bt.t / 5 * 100, 0, 100),
  net: () => S.net.p * 100,
  usb: () => (S.svc.usb ? S.svc.usb.p * 100 : 0),
  boot: () => (S.boot ? clamp((now() - S.boot.t0) / 4000 * 100, 0, 100) : 0),
  sensor: () => clamp((sensorV() - 4) / 16 * 100, 0, 100),
};
function live() {
  $$('[data-live]', screenEl).forEach((el) => {
    const k = el.dataset.live; let v;
    if (k.startsWith('g:')) { const g = GAUGES.find((x) => x.k === k.slice(2)); v = f0(g.v(S.m)); } else v = LIVE[k] ? LIVE[k]() : '';
    if (el.textContent !== String(v)) el.textContent = v;
  });
  $$('[data-w]', screenEl).forEach((el) => {
    const k = el.dataset.w; let w;
    if (k.startsWith('g:')) { const g = GAUGES.find((x) => x.k === k.slice(2)); w = gPct(g, g.v(S.m)); } else w = WIDTH[k] ? WIDTH[k]() : 0;
    el.style.width = w.toFixed(1) + '%';
  });
  $$('[data-left]', screenEl).forEach((el) => { el.style.left = clamp(S.m.soot, 0, 100) + '%'; });
  $$('[data-points]', screenEl).forEach((el) => {
    const hst = S.m.hydHist; const n = hst.length;
    el.setAttribute('points', hst.map((v, i) => `${(430 - (n - 1 - i) * (430 / 59)).toFixed(1)},${(70 - clamp(v - 50, 0, 50) * 1.4).toFixed(1)}`).join(' '));
  });
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
    S.access = md.sel; S.accessUntil = now() + 15 * 60e3; S.modal = null;
    toast(['Logged in as {0}.', () => tx(L.name)]);
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
  clearHist: () => {
    if (!need(1, 'clearHist')) return;
    S.modal = { type: 'confirm', title: 'Clear alarm history?', text: 'This removes {0} cleared alerts from the log. Active alerts stay. Save to USB first if you need a copy.', args: [historyAlerts().length], ok: 'Clear history', danger: true, then: 'doClearHist' };
  },
  doClearHist: () => { S.alerts = S.alerts.filter((a) => a.active); S.alertSel = null; toast(['Alarm history cleared.']); },
  legSel: (i) => { S.legSel = +i; },
  diag: (k) => { S.diag = k; },
  diagGo: (k) => { S.screen = 'engine'; S.diag = k; },
  brakeTest: () => { S.screen = 'engine'; S.diag = 'brake'; S.cam = null; if (S.bt.phase !== 'running') S.bt = { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: false, saved: false }; },
  netRun: () => { S.net.phase = 'running'; S.net.p = 0; },
  netSel: (id) => { S.net.sel = id; },
  btArea: () => { S.bt.area = !S.bt.area; },
  btStart: () => { Object.assign(S.bt, { phase: 'running', t: 0, dist: 0, max1: 0, max2: 0, saved: false }); },
  btReset: () => { S.bt = { phase: 'setup', t: 0, dist: 0, max1: 0, max2: 0, area: S.bt.area, saved: false }; },
  btSave: () => { S.bt.saved = true; S.reports.push({ t: now(), pass: S.bt.phase === 'pass' }); toast(['Brake test report saved to the machine log.']); },
  svcItem: (arg) => {
    const [gi, ii] = arg.split(':').map(Number); const it = DIR[gi].items[ii];
    if ((it.lvl || 0) > S.access) { need(it.lvl, 'svcItem', arg); return; }
    if (it.act) { dispatch(it.act, it.arg); return; }
    ACT.svcOpen(it.p);
  },
  svcOpen: (p) => {
    const gate = { outputs: 2, 'usb:backup': 2, 'usb:update': 2, 'params:system': 3, defaults: 3, 'calib:boom': 2, 'calib:joy': 2, 'calib:pedal': 2 }[p] || 0;
    if (gate > S.access) { need(gate, 'svcOpen', p); return; }
    S.screen = 'service'; S.svc.panel = p; S.svc.param = null; S.svc.mode = 'view'; S.svc.calib = null;
    if (p.startsWith('usb:')) S.svc.usb = null;
    if (p === 'params:system') S.svc.param = 'serial';
  },
  svcHome: () => { S.svc.panel = 'home'; S.svc.usb = null; S.svc.calib = null; },
  svcClearQ: () => { S.svc.q = ''; },
  pSel: (id) => { S.svc.param = id; S.svc.mode = 'view'; },
  pList: () => { S.svc.param = null; S.svc.mode = 'view'; },
  pEdit: () => { const f = findParam(S.svc.param); const lvl = f.p.level || 2; if (!need(lvl, 'pEdit')) return; S.svc.mode = 'edit'; S.svc.entry = String(PV[f.p.id]); },
  key: (k) => { S.svc.entry = (S.svc.entry + k).replace(/^0+(?=\d)/, '').slice(0, 5); },
  keyClr: () => { S.svc.entry = ''; },
  keyDel: () => { S.svc.entry = S.svc.entry.slice(0, -1); },
  pCancel: () => { S.svc.mode = 'view'; },
  pReview: () => { S.svc.mode = 'review'; },
  pBack: () => { S.svc.mode = 'edit'; },
  pSave: () => {
    const f = findParam(S.svc.param); const n = parseInt(S.svc.entry, 10); const old = PV[f.p.id];
    PV[f.p.id] = n; S.phist.push({ i: S.phist.length, t: now(), id: f.p.id, unit: f.p.unit, old, nw: n, by: S.access });
    S.svc.mode = 'view'; toast(['{0} saved: {1} → {2} {3}.', () => tx(f.p.name), old, n, () => tu(f.p.unit)]);
  },
  undo: (i) => {
    const h = S.phist[+i]; if (!h || h.undone) return;
    const f = findParam(h.id); if (!need(f.p.level || 2, 'undo', i)) return;
    PV[h.id] = h.old; h.undone = true;
    S.phist.push({ i: S.phist.length, t: now(), id: h.id, unit: h.unit, old: h.nw, nw: h.old, by: S.access, undone: true, isUndo: true });
    toast(['{0} restored to {1} {2}.', () => tx(f.p.name), h.old, () => tu(h.unit)]);
  },
  usbInsert: () => { S.svc.usb.inserted = true; },
  usbStart: () => { const u = S.svc.usb; if (u.kind === 'update') { u.phase = 'countdown'; u.t = 10; } else { u.phase = 'working'; u.p = 0; } },
  usbCancel: () => { S.svc.usb = null; toast(['Update cancelled. Stick removed.'], 'warn'); },
  usbDone: () => { S.svc.usb = null; S.svc.panel = 'home'; },
  restart: () => { S.svc.usb = null; S.svc.panel = 'home'; S.m.estop = false; S.boot = { t0: now(), kind: 'update' }; },
  calCap: () => { const c = S.svc.calib; c.cap[c.step] = Math.round(sensorV() * 10) / 10; c.step++; },
  calRedo: () => { S.svc.calib = { kind: S.svc.calib.kind, step: 0, cap: [] }; },
  calSave: () => { const k = S.svc.calib.kind; S.svc.calib = null; S.svc.panel = 'home'; toast([{ boom: 'Boom calibration saved.', joy: 'Joystick calibration saved.', pedal: 'Pedal calibration saved.' }[k]]); },
  outTest: (k) => {
    if (['freeCirc', 'relief', 'brake2'].includes(k) && !S.m.parkBrake) { toast(['Apply the parking brake before testing valves.'], 'warn'); return; }
    S.outputs[k] = now() + 2000;
  },
  defaultsAsk: () => { S.modal = { type: 'confirm', title: 'Restore factory defaults?', text: 'Every engine and drivetrain parameter goes back to its factory value. Each change is logged and can be undone.', ok: 'Restore defaults', danger: true, then: 'doDefaults' }; },
  doDefaults: () => {
    let n = 0;
    Object.values(PARAMS).forEach((g) => g.items.forEach((p) => { if (p.id !== 'serial' && PV[p.id] !== p.def) { S.phist.push({ i: S.phist.length, t: now(), id: p.id, unit: p.unit, old: PV[p.id], nw: p.def, by: S.access }); PV[p.id] = p.def; n++; } }));
    toast(n ? [n > 1 ? '{0} parameters restored to factory values.' : '{0} parameter restored to factory values.', n] : ['Everything was already at factory values.']);
  },
};
function dispatch(name, arg) { if (ACT[name]) { ACT[name](arg); render(); } }

screenEl.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || !screenEl.contains(el)) return;
  dispatch(el.dataset.act, el.dataset.arg);
});
screenEl.addEventListener('input', (e) => {
  if (e.target.id === 'svcSearch') { S.svc.q = e.target.value; const d = $('#svcDir'); if (d) d.innerHTML = renderDir(); }
  if (e.target.dataset.input === 'bright') { S.bright = +e.target.value; const dm = $('.dimmer', screenEl); if (dm) dm.style.opacity = ((100 - S.bright) / 100 * 0.75).toFixed(2); const k = $('#brightLbl'); if (k) k.textContent = tx('Brightness · {0}', pct(S.bright)); }
});
let holdTimer = null;
screenEl.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-hold]'); if (!el) return;
  el.classList.add('holding');
  holdTimer = setTimeout(() => { el.classList.remove('holding'); if (el.dataset.hold === 'resetTrip') { S.m.trip = 0; toast(['Trip reset to {0} km.', () => f1(0)]); render(); } }, 2000);
});
const cancelHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } $$('.holding', screenEl).forEach((x) => x.classList.remove('holding')); };
['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => screenEl.addEventListener(ev, cancelHold));
screenEl.addEventListener('keydown', (e) => {
  const el = e.target.closest && e.target.closest('[data-hold]');
  if (el && (e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
});
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
function renderScenarios() {
  scenEl.innerHTML = SCEN.map((s) => `<button class="pbtn" data-scen="${s.k}">${esc(tf(s.t))}<small>${esc(tf(s.d))}</small></button>`).join('');
}
scenEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-scen]'); if (!b) return;
  SCEN.find((s) => s.k === b.dataset.scen).f();
  $('#pThrottle').value = Math.round(S.m.throttle * 100);
  render();
});
function moveLeg(i, to) {
  if (S.m.speed > 0.5) { toast(['Stop the machine before moving the legs.'], 'warn'); return; }
  if (S.m.legs[i] === to && !S.legMove[i]) return;
  S.legMove[i] = { to, until: now() + 1400 + i * 250 };
}
$('.panel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  const m = S.m; const p = b.dataset.p; const v = b.dataset.v;
  if (p === 'engine') {
    if (m.engineOn) { m.engineOn = false; toast(['Engine stopped.']); }
    else if (m.estop) toast(['Release the emergency stop first.'], 'warn');
    else if (m.dir !== 'N') toast(['Put the drive lever in N to start the engine.'], 'warn');
    else { m.engineOn = true; toast(['Engine started.']); }
  }
  if (p === 'dir') m.dir = v;
  if (p === 'park') m.parkBrake = !m.parkBrake;
  if (p === 'pedal') m.pedal = !m.pedal;
  if (p === 'estop') { m.estop = !m.estop; if (!m.estop) toast(['Emergency stop released. Restart the engine.']); }
  if (p === 'legs') [0, 1, 2, 3].forEach((i) => moveLeg(i, v === 'down'));
  if (p === 'leg') moveLeg(+v, !m.legs[+v]);
  if (p === 'test') ACT.brakeTest();
  if (p === 'camera') S.cam = S.cam ? null : 'rear';
  if (p === 'reboot') S.boot = { t0: now(), kind: 'start' };
  render();
});
$('#pThrottle').addEventListener('input', (e) => { S.m.throttle = +e.target.value / 100; $('#pThrottleV').textContent = pct(e.target.value).replace(' ', ''); });
function syncPanel() {
  const m = S.m;
  const set = (id, txt, on) => { const el = $('#' + id); if (!el) return; if (el.textContent !== txt) el.textContent = txt; el.classList.toggle('on', !!on); };
  set('pEngine', tx(m.engineOn ? 'Running · tap to stop' : 'Stopped · tap to start'), m.engineOn);
  set('pPark', tx(m.parkBrake ? 'Applied|park' : 'Released|park'), m.parkBrake);
  set('pPedal', tx(m.pedal ? 'Pressed' : 'Released|pedal'), m.pedal);
  set('pEstop', tx(m.estop ? 'PRESSED · tap to release' : 'Released|estop'), m.estop);
  $$('#pDir button').forEach((b) => b.classList.toggle('on', b.dataset.v === m.dir));
  [0, 1, 2, 3].forEach((i) => { const el = $('#pLeg' + i); if (el) el.classList.toggle('on', !!m.legs[i]); });
  $('#pThrottleV').textContent = pct(Math.round(m.throttle * 100)).replace(' ', '');
}
const notes = $('#notes');
try { notes.value = localStorage.getItem('hmi-notes') || ''; } catch (e) { /* storage blocked */ }
notes.addEventListener('input', () => { try { localStorage.setItem('hmi-notes', notes.value); } catch (e) { /* ignore */ } });
$('#copyNotes').addEventListener('click', async () => {
  const msg = $('#copyMsg');
  try { await navigator.clipboard.writeText(notes.value); msg.textContent = tx('Copied.'); } catch (e) { notes.select(); msg.textContent = tx('Press Ctrl+C or Cmd+C to copy.'); }
  setTimeout(() => { msg.textContent = ''; }, 2500);
});

/* ================= scaling ================= */
const wrap = $('#deviceWrap'); const dev = $('#device');
function fit() {
  const stage = wrap.parentElement;
  const W = 1280 + 44, H = 800 + 44;
  const availW = stage.clientWidth;
  const narrow = window.innerWidth <= 1100;
  const availH = narrow ? Infinity : window.innerHeight - (wrap.getBoundingClientRect().top + window.scrollY) - 50;
  const k = Math.max(0.25, Math.min(availW / W, Math.max(availH, 420) / H, 1.25));
  dev.style.transform = `scale(${k})`;
  wrap.style.width = W * k + 'px'; wrap.style.height = H * k + 'px';
}
window.addEventListener('resize', fit);

/* ================= start ================= */
seedHistory();
S.boot = { t0: now(), kind: 'start' };
applyStatic();
render(); fit();
setTimeout(fit, 300);
setInterval(() => {
  const tNow = now(); const dt = Math.min(0.5, (tNow - last) / 1000); last = tNow;
  sim(dt); evalAlerts();
  if (sig() !== lastSig) render(); else live();
}, 250);
window.__hmi = { setLang, S, tx, DIR, ACT: (n, a) => dispatch(n, a) };
})();
