# NorSmart 3 Stage V display: redesign concept

An interactive prototype of an improved operator display for a Stage V underground machine, based on the NorSmart 3 Platform control system user interface manual v1.15.

**Live prototype:** https://ardakucuk87.github.io/norsmart-hmi-redesign/
**Turkish version:** https://ardakucuk87.github.io/norsmart-hmi-redesign/?lang=tr
**Design rationale:** https://ardakucuk87.github.io/norsmart-hmi-redesign/rationale.html

## CAN database

The display runs on the machine's CAN database, `BYM6.dbc` (16 messages, 124 signals). `tools/dbc2js.py` converts it into `can-db.js`. The simulator packs its state into 8-byte frames using the DBC bit layout, and every screen decodes what it shows from those frames, so a real CAN gateway could feed the same UI. Assumed units and scalings are listed in `app.js` (`ASSUME`) and shown on Diagnostics › CAN bus.

To regenerate after a DBC change:

```
python3 -I tools/dbc2js.py path/to/BYM6.dbc can-db.js
```

## What is in it

- Six screens: Drive, Exhaust (Stage V aftertreatment, simulated: not in BYM6), Alerts, Mixer, Diagnostics (engine and fault codes, valves, live CAN bus, brake test) and Service.
- A live machine simulator. The reviewer panel drives ignition, engine, drive lever, gas pedal, brakes, mixer drum, rear station, cab signals and lights, and can unplug the CAN bus or drop the rear ECU. Twelve fault scenarios.
- Every button works: guided DPF regeneration, alarm acknowledge and history, access-level login, parameter editing with review and undo, calibration wizards, output tests, USB backup and update flows, brake test, network check, cameras, day and night modes.

Demo access codes: Site supervisor 1111, Maintenance 2222, Factory 3333.

## Languages

English and Turkish. Switch with the EN / TR button in the display's top bar, or open the page with `?lang=tr`. The choice is remembered in the browser. All Turkish text lives in `i18n.js`, keyed by the English source string.

## Run locally

Open `index.html` in a browser. No build step and no dependencies.

## Notes

All values are simulated and must not be used as machine parameters. This is an independent design concept. It is not affiliated with or endorsed by Normet.
