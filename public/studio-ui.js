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
