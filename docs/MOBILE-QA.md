# Mobile UI validation

This layer adapts the existing Conver application for compact screens. All
original inline scripts, element IDs, event handlers, form contracts, API
routes, native configuration and persisted settings remain under the existing
application's control.

## Mobile behavior

- Five stable navigation destinations: Home, Practice, Voice, Insights, More.
  More opens a focus-contained sheet for Warmup, Cold Open, coaches, Settings
  and Help. Each option calls the original `navTo` function.
- Phone layouts also apply on short, landscape touch displays. The 761–767px
  overlap no longer exposes both the desktop sidebar and phone navigation.
- Public landing and policy documents retain document scrolling. The app alone
  owns its internal page scroller.
- Safari's visual viewport and Capacitor's existing keyboard events keep forms
  within the visible screen. Navigation yields space to the keyboard. Pinch zoom
  is permitted and does not trigger keyboard handling.
- Inputs use 16px text. Navigation, authentication actions and settings switches
  have at least 44px touch regions. Settings toggle tracks keep their original
  visual dimensions inside a larger label.
- Safe-area padding respects the notch and home indicator. Reduced-motion
  preferences disable the sheet animation. Auth screens isolate the app behind
  them from keyboard and assistive-technology focus.
- Existing mobile capability messaging for Real-Time remains intact. This
  change does not enable or rewrite camera analysis on phones.

## Automated checks

From the repository root, with QA dependencies installed outside the app:

```sh
npm install --prefix ../checks jsdom css-tree css-mediaquery
NODE_PATH=../checks/node_modules node scripts/ui-smoke.cjs public/index.html
NODE_PATH=../checks/node_modules node scripts/mobile-ui-smoke.cjs
NODE_PATH=../checks/node_modules node scripts/sharp-ui-smoke.cjs
NODE_PATH=../checks/node_modules node scripts/landing-smoke.cjs
node scripts/entry-smoke.cjs
python3 scripts/verify-ui-preservation.py
git diff --check
```

The mobile suite exercises actual route handlers, guest entry, sheet dismissal,
focus return, keyboard events and pinch-zoom handling. It resolves responsive
CSS at 320×568, 390×844, 430×932, 764×900, 844×390 (touch landscape),
768×1024 and 1440×900. It checks public scrolling, five primary touch targets,
sidebar visibility, input sizing and reduced motion. Network calls are stubbed.
These are DOM/cascade checks, not screenshot comparison or physical iOS tests.

## Required before an App Store submission

Run the following in Safari and the actual signed Capacitor build on a compact
iPhone and a notched iPhone. Repeat the key flows in landscape and with larger
system text/reduced motion:

1. Scroll the entire landing page; visit and return from every policy page.
2. Sign in, restore a saved session, recover a password and sign out. Open the
   keyboard on the last field and confirm that the submit control stays reachable.
3. Reach every primary and More destination. Open/close the sheet using VoiceOver
   and an external keyboard. Confirm focus stays in the sheet until dismissal.
4. Run one real practice analysis, one voice session, one Cold Open and one
   warmup. Test microphone denial, subsequent permission grant, and interruptions.
5. Verify feedback, scores, session history and each changed setting persist.
6. Test background/foreground restoration and a network disconnect/reconnect.
7. Confirm the native splash dismisses once, safe areas stay clear, and inputs
   remain visible during keyboard presentation/dismissal and device rotation.

The checked-in Capacitor configuration loads `https://conver.services/app`.
Hosted UI changes reach that shell; changing the native binary or submitting
to App Store Connect is a separate release operation. No physical iPhone or
signed-build verification was performed in this environment.

## Design references

- [Apple: UI design tips](https://developer.apple.com/design/tips/), touch target
  sizes and readable interfaces.
- [Apple: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars),
  stable, limited primary destinations.
- [WebKit: Designing websites for iPhone](https://webkit.org/blog/7929/designing-websites-for-iphone-x/),
  viewport coverage and safe-area padding.
- [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport),
  keyboard and pinch-zoom viewport differences.
- [Capacitor: Keyboard](https://capacitorjs.com/docs/apis/keyboard), existing
  body resize mode and native keyboard events.
