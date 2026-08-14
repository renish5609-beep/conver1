const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Apple 6.5" screenshot slot accepts either of these two exact pixel sizes:
//  - 1242x2688 (iPhone 11 Pro Max / XS Max class) -> CSS 414x896 @3x
//  - 1284x2778 (iPhone 12/13/14 Pro Max class)     -> CSS 428x926 @3x
// 13" iPad display (iPad Pro M4 class) required size is 2064x2752
//  -> CSS 1032x1376 @2x. Above the app's 767px mobile breakpoint, so this
//  renders the tablet/desktop header + top tab bar, not the phone chrome.
const SIZES = [
  { tag: '1242x2688', viewport: { width: 414, height: 896 }, dpr: 3, isMobile: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  { tag: '1284x2778', viewport: { width: 428, height: 926 }, dpr: 3, isMobile: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  { tag: '2064x2752-ipad', viewport: { width: 1032, height: 1376 }, dpr: 2, isMobile: false,
    ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
];

// Optional CLI filter: `node shots.js 2064x2752-ipad` runs just that tag.
const only = process.argv.slice(2);
const RUN = only.length ? SIZES.filter(s => only.includes(s.tag)) : SIZES;

async function capture({ tag, viewport, dpr, isMobile, ua }) {
  const OUT = path.join(__dirname, 'appstore-screens', tag);
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: dpr,
    isMobile,
    hasTouch: true,
    userAgent: ua,
  });
  const page = await context.newPage();
  await page.goto('http://localhost:30001/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  try {
    const guestBtn = page.locator('button:has-text("Continue as guest")');
    if (await guestBtn.count()) {
      await guestBtn.first().click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  try {
    const skip = page.locator('.ob-skip, [class*="skip"]');
    if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(500); }
  } catch (e) {}

  async function shoot(name, action) {
    if (action) await action();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
    console.log('saved', tag, name);
  }

  await page.evaluate(() => window.navTo && window.navTo('home'));
  await shoot('01-home.png');

  await page.evaluate(() => window.navTo && window.navTo('coldopen'));
  await shoot('02-coldopen.png');

  await page.evaluate(() => { if (window.navTo) window.navTo('practice'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (window.switchPracticeTab) window.switchPracticeTab('debate'); });
  await shoot('03-debate.png');

  await page.evaluate(() => window.navTo && window.navTo('voice'));
  await shoot('04-voice.png');

  // Seed realistic session history so Insights renders real charts/stats
  // instead of the guest "No data yet" empty state — S is the app's global
  // in-memory store (see const S={...} in index.html), never persisted
  // anywhere for guests, so this only affects this headless tab.
  await page.evaluate(() => {
    const scenarios = ['Interview', 'Pitch', 'Debate', 'Networking', 'Sales Call'];
    const coaches = ['Blaze', 'Echo', 'Sage', 'Nova', 'Rex'];
    const texts = [
      'I led the migration by breaking it into three phases and getting buy-in from each team lead before touching production.',
      'Our retention problem comes down to onboarding — users who finish setup in the first session stick around three times longer.',
      'Remote work gives people back the two hours they used to lose commuting, and that time shows up in the work.',
      'I opened by naming the budget concern directly instead of waiting for them to bring it up.',
      'The pilot numbers speak for themselves — 40% faster turnaround with the same headcount.',
    ];
    const hist = [];
    const now = Date.now();
    for (let i = 0; i < 14; i++) {
      const c = 5.5 + Math.random() * 4;
      const co = 5.5 + Math.random() * 4;
      const p = 5.5 + Math.random() * 4;
      hist.push({
        scenario: scenarios[i % scenarios.length],
        coach: coaches[i % coaches.length],
        text: texts[i % texts.length],
        analysis: {
          clarity: Math.round(c * 10) / 10,
          confidence: Math.round(co * 10) / 10,
          persuasion: Math.round(p * 10) / 10,
          storytelling: Math.round((5 + Math.random() * 4) * 10) / 10,
          conciseness: Math.round((5 + Math.random() * 4) * 10) / 10,
        },
        time: new Date(now - i * 1000 * 60 * 60 * 20),
      });
    }
    // S is a top-level `const` in index.html's inline script, so it lives in
    // that script's lexical scope, not on `window` — reference it bare here
    // since page.evaluate() runs in the same realm and can see it directly.
    S.history = hist;
    S.sessions = hist.length;
    S.scores = {
      clarity: hist.map(h => h.analysis.clarity),
      confidence: hist.map(h => h.analysis.confidence),
      persuasion: hist.map(h => h.analysis.persuasion),
    };
    S.streak = 6;
    S.xp = 1840;
    if (typeof updateChips === 'function') updateChips();
  });

  // 5. Insights (charts + stats)
  await page.evaluate(() => window.navTo && window.navTo('insights'));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    if (window.switchInsightsTab) window.switchInsightsTab('insights');
    if (window.renderInsights) window.renderInsights();
  });
  await shoot('05-insights.png');

  // 6. Settings
  await page.evaluate(() => window.navTo && window.navTo('settings'));
  await shoot('06-settings.png');

  await browser.close();
}

(async () => {
  for (const size of RUN) await capture(size);
})();
