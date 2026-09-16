# Conver Studio integration — preview review required

Branch: `ui/conver-studio-redesign`.
Functionality baseline: `56d4b025609047386bc3acb3996090ee47c78f74`.

This follow-up applies after the user's `ff3f934` patch (equivalent local tree `528ca2e`). It is not a substitute for the initial redesign.

## Implemented corrections

- Explicit Vercel rewrites serve the animated marketing intro at `/` and the original functional app at `/app`. Express already uses those routes. No API rewrites are added.
- Unsigned app entry redirects to `/landing.html`. Intro sign-in/signup links use `/app?auth=signin` and `/app?auth=signup`, fixing the previous circular redirect. Email verification, OAuth tokens and saved sessions are handled first.
- The intro retains the approved pearl/olive/brass hero, moving rings, typing line, rotating example quotes and explanations. All six coach letters are replaced by personality SVG symbols. Quotes are authored examples, not live AI responses.
- The supplied PNG is preserved in `app-icon.png`. An SVG viewBox wraps its exact pixels and removes equal outer padding for the visible brand and SVG favicon. PNG/ICO fallbacks and Apple touch links use the same identity.
- The iOS launcher is packaged as an opaque 1024-square PNG. No native code/configuration changes are made. A new native build/install is required to see its launcher change.
- Actual approved overview markup/styles are ported from the original concept: studio heading, animated copper ring, launch cards, coach strip and warmup strip. Buttons call original navigation; no mock sessions or sample account data are imported.
- Desktop sidebar reuses original navigation nodes/handlers. Mobile retains all real destinations. Original live score/stat nodes remain connected below the overview; redundant shortcuts remain reachable in a disclosure.
- Auth uses the concept's paired animated rings and responsive story/form layout around the real forms. Voice setup uses the stage/options composition around the real live-session button, coach picker and conversation log.

This is **not a verified 1:1 match of every screen**. Functional pages, tabs, settings, session overlays, dialogs and long-content/error states remain to be visually checked. Do not treat source reuse as visual sign-off.

## Evidence

- 30 source checks: original scripts except one exact reviewed auth-entry block; original IDs, inline handlers and form contracts retained. Backend, production dependencies, Capacitor configuration and build workflow unchanged. Only the launcher image may differ under `ios/`.
- 86 stubbed UI checks: guest entry, navigation, practice/insight tabs, six coaches, preferences, original feedback/report renderers, overview actions, live-button binding and synchronized coach presentation. No captured runtime errors.
- 12 entry checks run the actual `initAuth` with fake dependencies: direct paths, auth choices, invalid query, saved session, OAuth token, verification callback and Vercel mappings.
- Landing checks cover SVG card/detail updates, links, typing progression, all-six-coach quote shuffle and pause/resume.
- All four app/landing stylesheets parse. Presentation scripts pass syntax checks.

No live credentials were retrieved, changed or embedded. No production database or remote deployment was changed here.

## Reproduce

Use a separate test-only `jsdom@30.0.1` installation; it is not a production dependency.

```sh
python scripts/verify-ui-preservation.py
node scripts/entry-smoke.cjs
npm install --prefix /tmp/conver-ui-checks --no-save jsdom@30.0.1
NODE_PATH=/tmp/conver-ui-checks/node_modules node scripts/ui-smoke.cjs public/index.html
NODE_PATH=/tmp/conver-ui-checks/node_modules node scripts/landing-smoke.cjs
node --check public/studio-ui.js
node --check public/studio-landing.js
git diff --check
```

## Release gates

The unmodified backend cannot start here without `ELEVENLABS_API_KEY`. The cloud browser rejected localhost, so fresh viewport screenshots/geometry measurements were not obtained. DOM tests do not prove visual or live-service correctness.

1. Push this review branch and open the newest ready preview. Confirm its commit. Check `/`, `/landing.html`, `/app?auth=signin` and `/app?auth=signup`.
2. Compare the preview at 390/768/1440px, plus 320px overflow, keyboard and reduced-motion checks. Review login, signed-in app, all six coaches, every settings group, reports, errors and long content.
3. With securely configured staging services, verify signup/verification/reset/sign-in, settings persistence, history/stats, feedback and reports. A static Vercel preview may not have Render's API environment; a green static build alone is insufficient.
4. Verify ElevenLabs, microphone/camera permissions, MediaPipe, interruption/reconnect and native safe areas on web/iOS.
5. Confirm Render's connected branch and auto-deploy settings before merging. This patch does not itself deploy `conver.services`. Rebuild/install iOS for the launcher asset.

No database migration. Roll back with a Git revert and redeployment of the previous working revision.
