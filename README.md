# NorSmart 3 Stage V display: redesign concept

An interactive prototype of an improved operator display for a Stage V underground machine, based on the NorSmart 3 Platform control system user interface manual v1.15.

**Live prototype:** https://ardakucuk87.github.io/norsmart-hmi-redesign/
**Turkish version:** https://ardakucuk87.github.io/norsmart-hmi-redesign/?lang=tr
**Design rationale:** https://ardakucuk87.github.io/norsmart-hmi-redesign/rationale.html

## What is in it

- Six screens: Drive, Exhaust (Stage V aftertreatment), Alerts, Machine set-up, Diagnostics and Service.
- A live machine simulator. The reviewer panel drives the engine, direction, throttle, brakes, emergency stop and support legs, and loads fault scenarios.
- Every button works: guided DPF regeneration, alarm acknowledge and history, access-level login, parameter editing with review and undo, calibration wizards, output tests, USB backup and update flows, brake test, network check, cameras, day and night modes.

Demo access codes: Site supervisor 1111, Maintenance 2222, Factory 3333.

## Languages

English and Turkish. Switch with the EN / TR button in the display's top bar, or open the page with `?lang=tr`. The choice is remembered in the browser. All Turkish text lives in `i18n.js`, keyed by the English source string.

## Run locally

Open `index.html` in a browser. No build step and no dependencies.

## Notes

All values are simulated and must not be used as machine parameters. This is an independent design concept. It is not affiliated with or endorsed by Normet.
