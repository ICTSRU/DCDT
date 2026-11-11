# Changelog · سجل التغييرات

Versioning: one digit after the decimal point; after x.9 comes (x+1).0.

## v2.3 — 2026-11-11

**Added · إضافات**
- GitHub Actions auto-deploy (`.github/workflows/deploy-apps-script.yml`): a push to `main` that changes `apps-script/` runs a sanity check, pushes the code with clasp and updates the existing web-app deployment, so the `/exec` URL never changes.
- Repository layout for GitHub: `apps-script/` (Code.gs, Index.html, appsscript.json), `index.html` at the root (sign-in page for GitHub Pages), `.gitignore`.

**Changed · تغييرات**
- Sign-in page moved from `landing/index.html` to the repository root `index.html`.

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
