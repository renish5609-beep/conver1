/* Presentation enhancements only. Existing app callbacks own state and persistence. */
// A deliberate visit from the public site already has a route transition. Remove
// the older boot splash before auth is revealed so the visitor sees one branded
// moment, never two stacked animations.
(() => {
  const authView = new URLSearchParams(location.search).get('auth');
  if (!['signin', 'signup'].includes(authView)) return;
  document.documentElement.classList.add('studio-auth-entry');
  document.getElementById('boot-splash')?.remove();
})();

(() => {
  'use strict';
  const settings = document.getElementById('page-settings');
  if (!settings) return;
  const sections = [...settings.querySelectorAll('.settings-section-title')].map(title => ({
    title: title.textContent.trim(), panel: title.closest('.panel')
  })).filter(section => section.panel);
  const groups = {
    'All settings': null,
    Personal: ['Personal'],
    Coaching: ['Coaching Style', 'Default Scenario'],
    Voice: ['Voice & Audio'],
    Feedback: ['Analysis & Feedback'],
    Progress: ['Gamification'],
    Appearance: ['Appearance'],
    Account: ['Account', 'Data & Privacy', 'Danger Zone', 'About']
  };
  const navigation = document.createElement('nav');
  navigation.className = 'studio-settings-nav';
  navigation.setAttribute('aria-label', 'Settings categories');
  const status = document.createElement('p');
  status.className = 'studio-settings-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  for (const [name, titles] of Object.entries(groups)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.setAttribute('aria-pressed', String(!titles));
    button.addEventListener('click', () => {
      navigation.querySelectorAll('button').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      sections.forEach(section => { section.panel.hidden = !!titles && !titles.includes(section.title); });
      const visibleCount = sections.filter(section => !section.panel.hidden).length;
      status.textContent = name + ' · ' + visibleCount + ' sections';
    });
    navigation.append(button);
  }
  settings.querySelector('.section-head').after(navigation, status);

  // Give every existing preference control an accessible name without replacing it.
  settings.querySelectorAll('.setting-row').forEach(row => {
    const name = row.querySelector('.setting-info h4')?.textContent.trim();
    if (!name) return;
    row.querySelectorAll('input,select,textarea').forEach(control => {
      if (!control.getAttribute('aria-label') && !control.labels?.length) control.setAttribute('aria-label', name);
      // Toggle inputs have a wrapping label containing only their decorative slider.
      if (control.type === 'checkbox' && !control.getAttribute('aria-label')) control.setAttribute('aria-label', name);
    });
  });

  // Reuse navTo: no new navigation state, storage keys, or API calls.
  const mainNavigation = document.querySelector('#app-tabs .tabs-group');
  for (const [page, label] of [['settings', 'Settings'], ['contact', 'Help & feedback']]) {
    if (!mainNavigation || mainNavigation.querySelector('[data-page="' + page + '"]')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab-item studio-extra-nav';
    button.dataset.page = page;
    button.textContent = label;
    button.addEventListener('click', () => window.navTo(page));
    mainNavigation.append(button);
  }

  const selector = '.coach-profile-card,.sc-card,.accent-swatch,.hg-card';
  function enhance(element) {
    if (!element.matches(selector)) return;
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    if (element.matches('.coach-profile-card,.sc-card,.accent-swatch')) {
      element.setAttribute('aria-pressed', String(element.classList.contains('selected') || element.classList.contains('active')));
    }
    if (element.matches('.accent-swatch')) element.setAttribute('aria-label', 'Accent color ' + element.dataset.color);
  }
  document.querySelectorAll(selector).forEach(enhance);
  document.addEventListener('keydown', event => {
    if ((event.key !== 'Enter' && event.key !== ' ') || !event.target.matches(selector)) return;
    event.preventDefault();
    event.target.click();
  });
  // Coach cards are recreated by the existing renderer when selection changes.
  const observer = new MutationObserver(records => records.forEach(record => {
    if (record.type === 'attributes') { enhance(record.target); return; }
    record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      enhance(node);
      node.querySelectorAll(selector).forEach(enhance);
    });
  }));
  for (const target of document.querySelectorAll('#coach-profiles-grid,#settings-scenario-cards,.home-grid,.accent-swatch')) {
    observer.observe(target, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  }
})();

// Branded transitions are reserved for real context boundaries. In-app pages,
// sub-tabs, settings controls, and ordinary actions stay immediate.
(() => {
  const layer = document.createElement('div');
  layer.className = 'studio-route-transition';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `<div class="studio-transition-core">
    <div class="studio-dialogue-stage" aria-hidden="true">
      <span class="studio-speaker studio-speaker-left"><svg viewBox="0 0 112 136"><path class="studio-head-silhouette" d="M22 134l-1-18c-1-8-4-14-8-21C6 84 4 71 8 56 13 35 29 21 50 20c20-1 36 10 42 28 3 9 3 18 1 27-1 4 0 7 3 10l8 8c4 4 2 9-3 11l-7 2c1 3 0 6-3 8 3 3 2 7-2 9l-5 2-1 8c-1 8-7 12-16 12H55l2 15H22Z"/></svg></span>
      <span class="studio-dialogue-signal"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <span class="studio-speaker studio-speaker-right"><svg viewBox="0 0 112 136"><path class="studio-head-silhouette" d="M22 134l-1-18c-1-8-4-14-8-21C6 84 4 71 8 56 13 35 29 21 50 20c20-1 36 10 42 28 3 9 3 18 1 27-1 4 0 7 3 10l8 8c4 4 2 9-3 11l-7 2c1 3 0 6-3 8 3 3 2 7-2 9l-5 2-1 8c-1 8-7 12-16 12H55l2 15H22Z"/></svg></span>
    </div>
    <span class="studio-transition-word">conver<i>.</i></span>
    <span class="studio-transition-status">opening your studio</span>
  </div>`;
  document.body.append(layer);
  const status = layer.querySelector('.studio-transition-status');
  let closeTimer = 0;
  function pulse(label = 'opening your studio', duration = 620) {
    clearTimeout(closeTimer);
    status.textContent = label;
    layer.classList.remove('leaving');
    layer.classList.add('active');
    layer.setAttribute('aria-hidden', 'false');
    closeTimer = setTimeout(() => {
      layer.classList.add('leaving');
      setTimeout(() => {
        layer.classList.remove('active', 'leaving');
        layer.setAttribute('aria-hidden', 'true');
      }, 250);
    }, duration);
  }
  window.studioTransition = pulse;

  const auth = document.getElementById('auth-screen');
  if (auth) {
    const explicitAuthEntry = ['signin', 'signup'].includes(new URLSearchParams(location.search).get('auth'));
    let wasHidden = auth.classList.contains('hidden');
    let suppressInitialReveal = explicitAuthEntry && wasHidden;
    new MutationObserver(() => {
      const hidden = auth.classList.contains('hidden');
      if (hidden === wasHidden || document.getElementById('boot-splash')) return;
      if (!hidden && suppressInitialReveal) {
        suppressInitialReveal = false;
        wasHidden = hidden;
        return;
      }
      pulse(hidden ? 'opening your studio' : 'returning to sign in', 720);
      wasHidden = hidden;
    }).observe(auth, {attributes:true, attributeFilter:['class']});
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.href === location.href) return;
    const publicRoutes = new Set(['/','/landing.html','/privacy.html','/terms.html','/cookies.html','/contact.html','/support.html']);
    const isAuthBoundary = url.pathname === '/app' && ['signin','signup'].includes(url.searchParams.get('auth'));
    if (!publicRoutes.has(url.pathname) && !isAuthBoundary) return;
    event.preventDefault();
    const returningHome = url.pathname === '/' || url.pathname === '/landing.html';
    const openingLegal = ['/privacy.html','/terms.html','/cookies.html','/contact.html','/support.html'].includes(url.pathname);
    pulse(returningHome ? 'returning to conver' : openingLegal ? 'opening details' : 'opening sign in', 1100);
    setTimeout(() => location.assign(url.href), 390);
  }, true);
})();

// Directional application navigation with a real page/sub-tab history.
// This wraps the existing functions without replacing any page state, data,
// callbacks, persistence, or tool cleanup owned by index.html.
(() => {
  const originalNavTo = window.navTo;
  const originalPracticeTab = window.switchPracticeTab;
  const originalInsightsTab = window.switchInsightsTab;
  const originalBack = window.handleBackBtn;
  if (typeof originalNavTo !== 'function') return;

  const trail = [];
  let depth = 0;
  let restoring = false;
  const defaultSub = {practice:'practice', insights:'insights'};

  function state() {
    const page = document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';
    const sub = page === 'practice' ? (typeof currentPracticeTab === 'string' ? currentPracticeTab : 'practice')
      : page === 'insights' ? (typeof currentInsightsTab === 'string' ? currentInsightsTab : 'insights') : '';
    return {page, sub};
  }
  function same(a, b) { return a.page === b.page && a.sub === b.sub; }
  function targetFor(next) {
    if (next.page === 'practice' && next.sub) return document.getElementById('psub-' + next.sub);
    if (next.page === 'insights' && next.sub) return document.getElementById('insights-tab-' + next.sub);
    return document.getElementById('page-' + next.page);
  }
  function animate(next, reverse = false, pageChange = false) {
    const target = targetFor(next);
    if (!target || matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('reducemotion')) return;
    target.classList.remove('studio-slide-forward', 'studio-slide-back');
    void target.offsetWidth;
    const motionClass = reverse ? 'studio-slide-back' : 'studio-slide-forward';
    target.classList.add(motionClass);
    setTimeout(() => target.classList.remove(motionClass), 440);
    const scroller = document.querySelector('.app-content');
    if (scroller?.scrollTo && pageChange) scroller.scrollTo({top:0, behavior:'smooth'});
  }
  function previousLabel() {
    const previous = trail[trail.length - 1];
    if (!previous) return 'Home';
    if (previous.page === 'home') return 'Home';
    if (previous.page === 'practice' && previous.sub !== 'practice') return 'Practice';
    if (previous.page === 'insights' && previous.sub !== 'insights') return 'Insights';
    return (typeof PAGE_TITLES === 'object' && PAGE_TITLES[previous.page]) || 'Back';
  }
  function syncBack() {
    const current = state();
    const atRoot = current.page === 'home' && !trail.length;
    window.showBackBtn(!atRoot, previousLabel());
  }
  function commit(before, after, reverse = false) {
    if (same(before, after)) { syncBack(); return; }
    if (!restoring) {
      const last = trail[trail.length - 1];
      if (!last || !same(last, before)) trail.push(before);
      if (trail.length > 40) trail.shift();
    }
    animate(after, reverse, before.page !== after.page);
    syncBack();
  }
  function syncInsightsSelection(tab) {
    const buttons = [...document.querySelectorAll('#page-insights .insights-tab-btn')];
    if (!buttons.length) return;
    buttons[0].parentElement?.setAttribute('role', 'tablist');
    buttons.forEach(button => {
      const selected = button.id === 'itab-' + tab;
      button.classList.toggle('active', selected);
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute('aria-controls', 'insights-tab-' + button.id.replace('itab-', ''));
      // The legacy callback paints the current tab with the old purple accent.
      // Selection now belongs to the green active class, so clear those inline paints.
      button.style.removeProperty('background');
      button.style.removeProperty('border-color');
      button.style.removeProperty('color');
    });
  }

  window.navTo = function() {
    const rootCall = depth === 0;
    const before = rootCall ? state() : null;
    depth++;
    try { return originalNavTo.apply(this, arguments); }
    finally {
      depth--;
      if (rootCall) commit(before, state());
    }
  };
  if (typeof originalPracticeTab === 'function') {
    window.switchPracticeTab = function() {
      const rootCall = depth === 0;
      const before = rootCall ? state() : null;
      depth++;
      try { return originalPracticeTab.apply(this, arguments); }
      finally { depth--; if (rootCall) commit(before, state()); }
    };
  }
  if (typeof originalInsightsTab === 'function') {
    window.switchInsightsTab = function() {
      const rootCall = depth === 0;
      const before = rootCall ? state() : null;
      const tab = arguments[0];
      depth++;
      try { return originalInsightsTab.apply(this, arguments); }
      finally { depth--; syncInsightsSelection(tab); if (rootCall) commit(before, state()); }
    };
  }
  syncInsightsSelection(typeof currentInsightsTab === 'string' ? currentInsightsTab : 'insights');

  function cleanup(current) {
    // Preserve the original specialized exit behavior for active recording or
    // live-session states, then let the history controller perform navigation.
    if (['voice','coldopen','warmup'].includes(current.page) && typeof originalBack === 'function') {
      originalBack();
    } else if (current.page === 'practice' && current.sub === 'debate' && typeof window.resetDebate === 'function') {
      window.resetDebate();
    }
  }
  function restore(destination) {
    depth++;
    try {
      originalNavTo(destination.page);
      if (destination.page === 'practice' && typeof originalPracticeTab === 'function') originalPracticeTab(destination.sub || defaultSub.practice);
      if (destination.page === 'insights' && typeof originalInsightsTab === 'function') originalInsightsTab(destination.sub || defaultSub.insights);
    } finally { depth--; }
  }
  window.handleBackBtn = function() {
    const before = state();
    cleanup(before);
    const destination = trail.pop() || {page:'home', sub:''};
    restoring = true;
    try { restore(destination); }
    finally { restoring = false; }
    const after = state();
    animate(after, true, before.page !== after.page);
    syncBack();
  };

  syncBack();
})();

// Port the approved concept's actual overview markup. No demo state or mock APIs.
(() => {
  'use strict';
  const app = document.querySelector('.app');
  const page = document.getElementById('page-home');
  const tabs = document.getElementById('app-tabs-wrap');
  if (!app || !page || !tabs) return;
  const iconPaths = {
    'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
    'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    'square-pen': '<path d="M12 20h9M16 3l5 5L7 22l-5 1 1-5Z"/>',
    'audio-lines': '<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>',
    'messages-square': '<path d="M21 15H7l-4 4V3h18Zm-10 4h6l4 3v-3"/>',
    'zap': '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
    'layout-grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    'chart': '<path d="M4 20V10m8 10V4m8 16v-6"/>',
    'users': '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>',
    'settings': '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3Z"/>',
    'help': '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>'
  };
  function icon(name) {
    const wrapper = document.createElement('span');
    wrapper.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (iconPaths[name] || iconPaths['arrow-up-right']) + '</svg>';
    return wrapper.firstElementChild;
  }
  function navigate(destination) {
    window.navTo(destination === 'coaches' ? 'profiles' : destination);
  }
  const overview = document.createElement('section');
  overview.className = 'studio-concept studio-overview';
  overview.setAttribute('aria-label', 'Your studio');
  overview.innerHTML = "\n          <div class=\"at-heading\"><div><div class=\"at-overline\">A LITTLE PRACTICE. A DIFFERENT PRESENCE.</div><h1>Your studio.</h1></div><button class=\"at-text-button cursor-interaction\" data-studio-page=\"insights\">Your progress <i data-lucide=\"arrow-up-right\" aria-hidden=\"true\"></i></button></div>\n          <div class=\"at-hero at-shine\">\n            <div class=\"at-hero-grain\" aria-hidden=\"true\"></div><div class=\"at-hero-art\" aria-hidden=\"true\"><div class=\"at-orbit at-orbit-back\"></div><div class=\"at-liquid-ring\"></div><div class=\"at-orbit at-orbit-front\"></div><span class=\"at-star at-star-one\"></span><span class=\"at-star at-star-two\"></span><span class=\"at-star at-star-three\"></span><span class=\"at-art-caption\">POTENTIAL, IN MOTION.</span></div>\n            <div class=\"at-hero-copy\"><div class=\"at-hero-kicker\"><span></span>THE CONVERSATION IS YOURS.</div><h2>Find your voice.<br><span>Own the room.</span></h2><p>For the interview. The big idea.<br>The moment that matters.</p><button class=\"at-button at-button-cream cursor-interaction\" data-studio-page=\"voice\">Enter the studio <span><i data-lucide=\"arrow-up-right\" aria-hidden=\"true\"></i></span></button><div class=\"at-hero-foot\"><span class=\"at-mini-wave\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i></span>YOUR VOICE. ONLY STRONGER.</div></div>\n          </div>\n          <div class=\"at-section-heading\"><h3>Make your next move.</h3><span>Choose your practice</span></div>\n          <div class=\"at-launch-grid\">\n            <button class=\"at-launch cursor-interaction\" data-studio-page=\"practice\"><span class=\"at-launch-top\"><span class=\"at-launch-icon\"><i data-lucide=\"square-pen\" aria-hidden=\"true\"></i></span><i class=\"at-launch-arrow\" data-lucide=\"arrow-up-right\" aria-hidden=\"true\"></i></span><strong>Practice Lab</strong><span class=\"at-launch-desc\">Sharper answers.<br>Stronger first impressions.</span><span class=\"at-launch-bottom\">WRITE · REFINE · REPEAT</span></button>\n            <button class=\"at-launch at-launch-dark cursor-interaction\" data-studio-page=\"voice\"><span class=\"at-launch-top\"><span class=\"at-launch-icon\"><i data-lucide=\"audio-lines\" aria-hidden=\"true\"></i></span><i class=\"at-launch-arrow\" data-lucide=\"arrow-up-right\" aria-hidden=\"true\"></i></span><strong>Voice Studio</strong><span class=\"at-launch-desc\">A real conversation.<br>A little more confidence.</span><span class=\"at-voice-wave\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span></button>\n            <button class=\"at-launch at-launch-peach cursor-interaction\" data-studio-page=\"coldopen\"><span class=\"at-launch-top\"><span class=\"at-launch-icon\"><i data-lucide=\"messages-square\" aria-hidden=\"true\"></i></span><i class=\"at-launch-arrow\" data-lucide=\"arrow-up-right\" aria-hidden=\"true\"></i></span><strong>Cold Open</strong><span class=\"at-launch-desc\">Think on your feet.<br>Connect in the moment.</span><span class=\"at-launch-bottom\">EXPECT THE UNEXPECTED</span></button>\n          </div>\n          <div class=\"at-lower-grid\"><div class=\"at-coach-strip\"><div class=\"at-coach-art at-art-blaze\"><img class=\"studio-coach-symbol\" src=\"/coach-blaze.svg\" alt=\"\" aria-hidden=\"true\"></div><div><span class=\"at-overline\">IN YOUR CORNER</span><h3 class=\"at-selected-name\">Blaze</h3><p class=\"at-selected-description\">Direct. Energetic. In your corner.</p></div><button class=\"at-circle cursor-interaction\" data-studio-page=\"coaches\" aria-label=\"Choose your coach\"><i data-lucide=\"arrow-up-right\" aria-hidden=\"true\"></i></button></div><button class=\"at-warmup-strip cursor-interaction\" data-studio-page=\"warmup\"><span class=\"at-warmup-symbol\"><i data-lucide=\"zap\" aria-hidden=\"true\"></i></span><span><strong>Start small. Build momentum.</strong><small>A quick warmup goes a long way.</small></span><i data-lucide=\"arrow-right\" aria-hidden=\"true\"></i></button></div>\n        ";
  overview.querySelectorAll('[data-lucide]').forEach(placeholder => {
    const svg = icon(placeholder.dataset.lucide);
    svg.setAttribute('class', placeholder.className);
    placeholder.replaceWith(svg);
  });
  overview.querySelectorAll('[data-studio-page]').forEach(button => {
    button.type = 'button';
    button.addEventListener('click', () => navigate(button.dataset.studioPage));
  });
  // Move the real counters and score rather than copying or inventing data.
  const progress = document.createElement('section');
  progress.className = 'studio-progress-row';
  progress.setAttribute('aria-label', 'Your progress');
  progress.append(page.querySelector('.hero-stats'), page.querySelector('.conver-score-card'));
  const oldHero = page.querySelector('.home-hero');
  oldHero.replaceWith(overview);
  const shortcuts = document.createElement('details');
  shortcuts.className = 'studio-more-tools';
  const summary = document.createElement('summary');
  summary.textContent = 'More practice shortcuts';
  shortcuts.append(summary, page.querySelector('.home-grid'));
  page.append(progress, shortcuts);

  // Keep the original navigation nodes, IDs and handlers. Only their layout changes.
  tabs.classList.add('studio-concept');
  const sidebar = document.createElement('div');
  sidebar.className = 'at-sidebar';
  const brand = document.createElement('a');
  brand.className = 'at-brand';
  brand.href = '/';
  brand.setAttribute('aria-label', 'Conver introduction');
  brand.innerHTML = '<span class="at-brandmark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>conver<span class="at-brand-period">.</span>';
  const label = document.createElement('div');
  label.className = 'at-sidebar-label';
  label.textContent = 'YOUR WORKSPACE';
  const nav = document.getElementById('app-tabs');
  const group = nav.querySelector('.tabs-group');
  const coaches = document.createElement('button');
  coaches.type = 'button';
  coaches.className = 'tab-item';
  coaches.dataset.page = 'profiles';
  coaches.textContent = 'Your coaches';
  coaches.addEventListener('click', () => navigate('coaches'));
  group.append(coaches);
  const config = [['home','layout-grid'],['practice','square-pen'],['voice','audio-lines'],['coldopen','messages-square'],['warmup','zap'],['profiles','users'],['insights','chart'],['settings','settings'],['contact','help']];
  config.forEach(([name,symbol]) => {
    const button = group.querySelector('[data-page="' + name + '"]');
    if (!button) return;
    const text = document.createElement('span');
    text.textContent = name === 'voice' ? 'Voice Studio' : button.textContent;
    button.replaceChildren(icon(symbol), text);
    button.classList.add('at-nav');
    group.append(button);
  });
  group.classList.add('at-navigation');
  const footer = document.createElement('div');
  footer.className = 'at-sidebar-bottom';
  footer.innerHTML = '<div class="at-sidebar-art" aria-hidden="true">' + '<span></span>'.repeat(9) + '</div><p>Great conversations<br>start with practice.</p>';
  sidebar.append(brand, label, nav, footer);
  tabs.append(sidebar);
  app.classList.add('studio-connected');

  // Use the preview's stage/options composition, with the real live-session controls.
  const voiceControls = document.querySelector('.voice-controls-side');
  const voiceAvatar = document.getElementById('voice-coach-avatar');
  if (voiceControls && voiceAvatar) {
    const stage = document.createElement('section');
    stage.className = 'studio-voice-stage';
    stage.setAttribute('aria-label', 'Voice session');
    const caption = document.createElement('p');
    caption.className = 'studio-stage-label';
    caption.textContent = 'YOUR VOICE. ONLY STRONGER.';
    const hint = document.createElement('p');
    hint.className = 'studio-stage-hint';
    hint.textContent = 'Space to try. Permission to stumble. That’s how better begins.';
    stage.append(caption, voiceAvatar, hint, voiceControls.querySelector('button[onclick="startVoiceSession()"]'));
    const options = document.createElement('div');
    options.className = 'studio-voice-options';
    options.append(...voiceControls.querySelectorAll(':scope>.vc-card'));
    voiceControls.append(stage, options);
  }

  const descriptions = {Blaze:'Direct. Energetic. In your corner.',Echo:'Warm feedback. Room to find your rhythm.',Sage:'A thoughtful perspective. A clearer path.',Nova:'Bold ideas. Fresh energy. Forward motion.',Rex:'Clear standards. Deliberate progress.',Luna:'Space to experiment. Permission to grow.'};
  const homeCoach = document.getElementById('home-coach');
  function syncCoach() {
    const name = homeCoach.textContent.trim();
    if (!Object.hasOwn(descriptions, name)) return;
    overview.querySelector('.at-selected-name').textContent = name;
    overview.querySelector('.at-selected-description').textContent = descriptions[name];
    const image = overview.querySelector('.studio-coach-symbol');
    image.src = '/coach-' + name.toLowerCase() + '.svg';
    image.parentElement.dataset.coach = name.toLowerCase();
  }
  new MutationObserver(syncCoach).observe(homeCoach, {childList:true,subtree:true,characterData:true});
  syncCoach();
  // Original navTo remains authoritative; observe its active state for aria-current.
  function syncNavigation() {
    group.querySelectorAll('.tab-item').forEach(button => {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  new MutationObserver(syncNavigation).observe(group, {subtree:true,attributes:true,attributeFilter:['class']});
  syncNavigation();
  // A subtle pointer response uses only the ported hero, and honors saved/system motion.
  const hero = overview.querySelector('.at-hero');
  hero.addEventListener('pointermove', event => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('reducemotion') || event.pointerType === 'touch') return;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--at-mx', ((event.clientX-rect.left)/rect.width-.5)*12+'px');
    hero.style.setProperty('--at-my', ((event.clientY-rect.top)/rect.height-.5)*10+'px');
  });
  hero.addEventListener('pointerleave', () => {hero.style.setProperty('--at-mx','0px');hero.style.setProperty('--at-my','0px');});
  // Onboarding is rendered by the original code after sign-in; update only its image.
  function updateBrand(scope) {
    if (scope.nodeType !== 1) return;
    const images = scope.matches('img[src="/logo.png"]') ? [scope] : scope.querySelectorAll('img[src="/logo.png"]');
    images.forEach(image => { image.src = '/conver-mic.svg?v=3'; });
  }
  updateBrand(document.body);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(updateBrand))).observe(document.body, {childList:true,subtree:true});
})();

// Shared coach artwork and accessible selection styling; original callbacks own state.
(() => {
  const coaches = new Set(['blaze', 'echo', 'sage', 'nova', 'rex', 'luna']);
  function decorateCoach(card) {
    if (!card.matches('.cp-btn,.ob-coach-card')) return;
    const name = (card.dataset.coach || card.id.replace('vcp-', '')).toLowerCase();
    if (!coaches.has(name)) return;
    const slot = card.querySelector('.cp-init,.ob-coach-orb');
    if (!slot) return;
    card.dataset.studioCoach = name;
    if (!slot.querySelector('.studio-picker-symbol')) {
      const image = document.createElement('img');
      image.className = 'studio-picker-symbol';
      image.src = '/coach-' + name + '.svg';
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      slot.replaceChildren(image);
    }
    if (card.matches('.cp-btn')) card.setAttribute('aria-pressed', String(card.classList.contains('active')));
  }
  function decorateWithin(scope) {
    if (scope.nodeType !== 1) return;
    if (scope.matches('.cp-btn,.ob-coach-card')) decorateCoach(scope);
    scope.querySelectorAll('.cp-btn,.ob-coach-card').forEach(decorateCoach);
  }
  decorateWithin(document.body);
  // Onboarding may be inserted after authentication. Ignore our own image nodes.
  new MutationObserver(records => records.forEach(record => {
    if (record.type === 'attributes') decorateCoach(record.target);
    else record.addedNodes.forEach(decorateWithin);
  })).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});

  const categories = [...document.querySelectorAll('.scenario-cat-btn')];
  function syncCategory(card) {
    // selectColdOpenCategory already sets this exact selection indicator.
    card.setAttribute('aria-pressed', String(card.style.borderWidth === '2px'));
  }
  const observer = new MutationObserver(records => records.forEach(record => syncCategory(record.target)));
  categories.forEach(card => {
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    syncCategory(card);
    observer.observe(card, {attributes:true, attributeFilter:['style']});
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      card.click();
    });
  });
})();

// Replace only the small legacy canvas presentation. Existing skill values,
// rendering calls, persistence and score calculations remain authoritative.
(() => {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;
  const keys = ['clarity', 'confidence', 'persuasion', 'storytelling', 'conciseness'];
  const labels = ['CLARITY', 'CONFIDENCE', 'PERSUASION', 'STORYTELLING', 'CONCISENESS'];
  const W = 420;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2 + 2;
  const radius = 118;
  const labelRadius = 158;

  function point(index, distance) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / keys.length;
    return {x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance, angle};
  }

  function drawStudioRadar() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.aspectRatio = W + ' / ' + H;
    canvas.dataset.studioRadar = 'enhanced';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    const state = typeof S !== 'undefined' && S.skills ? S.skills : {};
    const values = keys.map(key => Math.max(0, Math.min(100, Number(state[key]) || 0)));
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', labels.map((label, index) => label.toLowerCase() + ' ' + Math.round(values[index])).join(', '));

    // Five precise levels and their axes establish hierarchy even before data exists.
    for (let ring = 5; ring >= 1; ring--) {
      ctx.beginPath();
      keys.forEach((_, index) => {
        const p = point(index, radius * ring / 5);
        if (!index) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = ring % 2 ? 'rgba(213,224,202,.018)' : 'rgba(213,224,202,.035)';
      ctx.fill();
      ctx.strokeStyle = ring === 5 ? 'rgba(201,214,188,.34)' : 'rgba(201,214,188,.16)';
      ctx.lineWidth = ring === 5 ? 1.2 : 1;
      ctx.stroke();
    }
    keys.forEach((_, index) => {
      const p = point(index, radius);
      ctx.beginPath();ctx.moveTo(cx, cy);ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(201,214,188,.16)';ctx.lineWidth = 1;ctx.stroke();
    });

    // Real values only—no invented baseline—drawn in the Studio copper/olive system.
    ctx.beginPath();
    values.forEach((value, index) => {
      const p = point(index, radius * value / 100);
      if (!index) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    const fill = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    fill.addColorStop(0, 'rgba(126,150,105,.28)');
    fill.addColorStop(1, 'rgba(214,145,88,.25)');
    ctx.fillStyle = fill;ctx.fill();
    ctx.strokeStyle = '#d2925d';ctx.lineWidth = 2.25;ctx.stroke();

    if (values.some(Boolean)) {
      values.forEach((value, index) => {
        const p = point(index, radius * value / 100);
        ctx.beginPath();ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);ctx.fillStyle = '#253020';ctx.fill();
        ctx.beginPath();ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);ctx.fillStyle = '#e0a36b';ctx.fill();
      });
    } else {
      ctx.beginPath();ctx.arc(cx, cy, 12, 0, Math.PI * 2);ctx.strokeStyle = 'rgba(224,163,107,.38)';ctx.lineWidth = 1;ctx.stroke();
      ctx.beginPath();ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);ctx.fillStyle = '#e0a36b';ctx.fill();
    }

    labels.forEach((label, index) => {
      const p = point(index, labelRadius);
      const cosine = Math.cos(p.angle);
      const sine = Math.sin(p.angle);
      ctx.textAlign = cosine > .25 ? 'right' : cosine < -.25 ? 'left' : 'center';
      ctx.textBaseline = sine > .55 ? 'top' : sine < -.55 ? 'bottom' : 'middle';
      ctx.font = '700 10px Manrope, sans-serif';
      ctx.fillStyle = '#edf1e6';
      ctx.fillText(label, p.x, p.y);
    });
  }

  window.drawRadar = drawStudioRadar;
  drawStudioRadar();
  document.fonts?.ready?.then(drawStudioRadar);
})();
