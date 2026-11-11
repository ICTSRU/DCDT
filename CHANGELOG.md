# Changelog · سجل التغييرات

Versioning: one digit after the decimal point; after x.9 comes (x+1).0.

## v2.3 — 2026-11-11

**Added · إضافات**
- GitHub Actions auto-deploy (`.github/workflows/deploy-apps-script.yml`): a push to `main` that changes `apps-script/` runs a sanity check, pushes the code with clasp and updates the existing web-app deployment, so the `/exec` URL never changes.
- Repository layout for GitHub: `apps-script/` (Code.gs, Index.html, appsscript.json), `index.html` at the root (sign-in page for GitHub Pages), `.gitignore`.

**Changed · تغييرات**
- Sign-in page moved from `landing/index.html` to the repository root `index.html`.

## v2.5 — 2026-11-11

**Added · إضافات**
- **Rack photos:** up to 4 real photos per rack (e.g. front and rear). Add and delete them from *Settings → edit rack*; every user sees them in the rack details on the dashboard, with a full-size viewer (next/previous, Esc to close).
- Photos are compressed in the browser (max 1600 px, JPEG) and stored privately in a Drive folder called *DC Digital Twin Photos* in the owner's Drive. They are served only through the app, so access follows the `AllowedUsers` list. A photo can only be read if it is registered on a rack.
- New `Photos` column in the `Racks` sheet (added automatically to existing sheets). Deleting a rack moves its photos to the Drive trash. Photo changes are written to `ChangeLog`.

**Needs one manual step · خطوة يدوية لمرة واحدة**
- The script now uses Google Drive. After the first auto-deploy, the owner must open Apps Script, run the `setup` function once and approve the new Drive permission. Until then the dashboard may show an authorization error.

## v2.4 — 2026-11-11

**Changed · تغييرات**
- Power is now entered, stored and shown in **watts (W)** instead of kilowatts: rack power capacity, device power, the default capacity setting, the placement what-if, KPIs, floor plan and tables.
- Sheet columns renamed: `PowerCapKW` → `PowerCapW` (Racks), `PowerKW` → `PowerW` (Devices); setting `DefaultPowerCapKW` → `DefaultPowerCapW` (Settings).
- **Automatic migration:** existing v2.0–v2.3 sheets are converted once (headers renamed, values × 1000) the first time the page opens or `setup` runs. Nothing to do by hand.
- Ranges: rack capacity 100–100000 W, device power 0–50000 W. Default rack capacity 6000 W.

## v2.3.1 — 2026-11-11

**Fixed**
- Deploy workflow: secrets are passed through environment variables (the multi-line CLASPRC_JSON broke the shell check).

## v2.2 — 2026-11-08

**Changed · تغييرات**
- Official logos (ITOC, ICTD Executive Directorate, Sulaiman Alrajhi University) now shown at 40px in the white brand bar of both the dashboard and the sign-in page, replacing the text marks.

## v2.1 — 2026-11-07

**Changed · تغييرات**
- Web app deployment URL set in `landing/index.html` (`APP_URL`); the sign-in button is now active.
- Version labels updated to v2.1 (no functional change in `Code.gs` / `Index.html`).

## v2.0 — 2026-11-07

**Added · إضافات**
- Google Sheets backend through Apps Script (`Code.gs`): sheets `Settings`, `Racks`, `Devices`, `AllowedUsers`, `AccessLog`, `ChangeLog`.
- **Settings page**: register racks (add, edit, delete, bulk generate by rows), rack contents, and per-device data (name, type, status, rack, start U, height U, power kW, vendor, model, serial, asset tag, IP, owner, notes).
- Dashboard now reads everything from the sheet: floor plan built from the racks' rows and positions, rack elevation of any height, device table and device card, KPIs, alerts and placement suggestion.
- Device search by name, IP, serial, asset tag, model, vendor or owner, with its rack and U location.
- Configurable thresholds and room name from the Settings page.
- Server-side validation: device inside rack height, no overlap, unique rack ID and position, rack cannot shrink below its devices.
- `@sr.edu.sa` access with `admin` and `viewer` roles, sign-in log, change log, ITOC sign-in landing page.
- Arabic (default, RTL) and English; light and dark themes; phone layout.
- Browser-only demo mode when `Index.html` is opened outside Apps Script.

**Changed · تغييرات**
- Electrical load is now the sum of registered device power (Active and Maintenance), not simulated values.
- Removed the simulated live feed and fixed sample rack layout of v1.0.

## v1.0 — 2026-11-04
- Interactive pilot prototype with sample data: floor plan heat map, rack detail, placement what-if, alerts.
