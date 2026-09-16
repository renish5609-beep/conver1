/* Presentation enhancements only. Existing app callbacks own state and persistence. */
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
    Account: ['Account', 'Data & Privacy', 'Danger Zone', 'ℹ About']
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

// Branded transitions for account state, application pages, and full-page routes.
(() => {
  const layer = document.createElement('div');
  layer.className = 'studio-route-transition';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="studio-transition-core"><span class="studio-transition-mark"><img src="/brand-mark.svg" alt=""></span><span class="studio-transition-word">conver<i>.</i></span><span class="studio-transition-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="studio-transition-status">opening your studio</span></div>';
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

  const originalNavTo = window.navTo;
  if (typeof originalNavTo === 'function') {
    window.navTo = function(page) {
      const destination = typeof PAGE_TITLES === 'object' ? PAGE_TITLES[page] : page;
      pulse(destination ? 'opening ' + String(destination).toLowerCase() : 'opening your studio');
      return originalNavTo.apply(this, arguments);
    };
  }
  const originalShowView = window.showView;
  if (typeof originalShowView === 'function') {
    window.showView = function(view) {
      pulse(view === 'signup' ? 'creating your space' : 'opening sign in');
      return originalShowView.apply(this, arguments);
    };
  }

  const auth = document.getElementById('auth-screen');
  if (auth) {
    let wasHidden = auth.classList.contains('hidden');
    new MutationObserver(() => {
      const hidden = auth.classList.contains('hidden');
      if (hidden === wasHidden || document.getElementById('boot-splash')) return;
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
    event.preventDefault();
    pulse(url.pathname === '/' || url.pathname === '/landing.html' ? 'returning to conver' : 'opening your studio', 1100);
    setTimeout(() => location.assign(url.href), 390);
  }, true);
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
