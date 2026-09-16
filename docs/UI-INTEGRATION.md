# Conver Studio integration — draft, not deployed

Branch: `ui/conver-studio-redesign`
Baseline: `56d4b025609047386bc3acb3996090ee47c78f74`

## Implemented

- Replaced the marketing landing page with the approved pearl, olive and copper design, responsive layout, animated sculpture, rotating example coach quotes, feature explanations, four-step walkthrough and six-coach selector.
- Converted preview navigation into real `/app`, section, contact and legal links. Landing quotes are authored examples, not live API responses. Coach selection on the marketing page previews coach descriptions; the app retains its existing coach-selection flow.
- Added the new visual system to the original functional app through `public/studio.css`: typography, surfaces, desktop sidebar layout, home, cards, practice tabs, coaches, settings controls, dialogs, onboarding, auth and mobile navigation.
- Added the split-layout authentication presentation around the existing sign-in/sign-up/guest controls. Existing validation, password reset, Supabase and guest behavior are unchanged.
- Styled the existing contact, support and legal pages without changing their text or submission logic.
- Kept existing accent preferences and their saved values. This pass deliberately does not migrate preferences or replace existing screens with mockup behavior.

This is the first integration pass, not a claim of complete visual parity with every mockup or release readiness. The app still uses the original functional screen structure underneath the shared styling. Screen-by-screen visual refinement remains necessary, especially dynamically generated session results, camera overlays, dialogs, charts, long content and narrow layouts.

## Preservation evidence

`python scripts/verify-ui-preservation.py` passes 30 checks against the baseline commit:

- All original app/contact/legal inline and external script tags are unchanged.
- Original element IDs, inline event handlers and form contracts remain unchanged.
- `server.js`, runtime dependencies, lockfile, Capacitor configuration, Codemagic workflow and native iOS files are unchanged.

The DOM smoke harness passes the same 20 checks before and after: guest entry, eight app pages, six Practice Lab tabs, four Insights tabs and the share dialog. Captured requests are identical; there are no captured runtime errors. Network, Supabase and media dependencies are stubbed in these tests. They do not prove live service correctness or visual correctness.

The landing harness checks feature/step counts, all six coach selectors, quote shuffle and pause/resume, section anchors and local page links. All three new stylesheets parse successfully.

## Reproduce checks

The preservation check uses Python's standard library. The smoke checks require `jsdom` in a separate test environment; it is not a production dependency.

```sh
python scripts/verify-ui-preservation.py
npm install --prefix /tmp/conver-ui-checks --no-save jsdom@30.0.1
NODE_PATH=/tmp/conver-ui-checks/node_modules node scripts/ui-smoke.cjs public/index.html
NODE_PATH=/tmp/conver-ui-checks/node_modules node scripts/landing-smoke.cjs
node --check public/studio-landing.js
git diff --check
```

## Baseline startup and outstanding gates

`npm ci --ignore-scripts` succeeds. Unmodified `npm start` fails because `ELEVENLABS_API_KEY` is absent in this workspace. No production secrets were retrieved or changed. Use a securely configured development/staging environment for real-service testing. Do not put secrets into commits or chat.

The available cloud browser rejected localhost with `ERR_BLOCKED_BY_CLIENT`; visual screenshots and viewport measurements were not obtained. The static frontend can be served locally for review with:

```sh
python -m http.server 4173 --directory public
```

This static server serves `/landing.html` and `/index.html` for visual review only; it does not implement Express routes, auth or APIs. Use the actual configured Node server for functional review.

Before production deployment:

- Review landing, sign-in/signup/reset, onboarding and every app page at 320/390/768/1440px, with keyboard focus and reduced motion.
- Review all six coaches, settings toggles, saved accents, compact mode, mobile navigation, empty/loading/error states, generated feedback and session reports. Check text contrast on legacy inline dark backgrounds and camera overlays.
- Verify account lifecycle, guest-to-account transition, settings persistence, session history/stats and all authenticated endpoints using a staging account.
- Verify voice, ElevenLabs streaming/reconnect, transcription, mic/camera permission denial, MediaPipe, reports/export and contact submission.
- Verify Capacitor/iOS safe areas, keyboard, foreground/background transitions and native permissions on device. The native app currently loads the hosted `/app` URL, so a web deployment can affect it.
- Check Render's connected branch and auto-deploy setting, then use a preview/staging deployment before merging.

## GitHub / deployment status

A push dry-run failed because this workspace has no GitHub write credentials. No remote branch, PR, merge or deployment was created. Authenticate Git with permission for this repository, then push this review branch. Do not push directly to `main` as a substitute for staging verification.

Rollback is a normal Git revert of the integration commit followed by deployment of the previous working version. No database migration is included.
