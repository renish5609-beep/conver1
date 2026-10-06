/* Mobile header presentation only. Native page scrolling and navigation own state. */
(() => {
  const header = document.querySelector('.app-header, #conver-atelier .at-site-header');
  if (!header) return;
  const mobile = matchMedia('(max-width:767px), (max-height:500px) and (pointer:coarse)');
  const app = header.closest('.app');
  const originalInert = header.inert;
  const originalAria = header.getAttribute('aria-hidden');
  const style = document.createElement('style');
  style.textContent = `
    @media(max-width:767px), (max-height:500px) and (pointer:coarse){
      html.studio-scroll-app,body.studio-app-host{height:100%;min-height:0;overflow:hidden;background:#f7f6f2!important}
      .studio-connected.app{position:fixed;top:0;left:0;right:0;bottom:auto;margin:0;height:var(--studio-viewport-height,100dvh);min-height:var(--studio-viewport-height,100dvh);max-height:var(--studio-viewport-height,100dvh);background:#f7f6f2}
      .studio-connected .mobile-nav{position:absolute;bottom:0;background:#f7f6f2;box-shadow:0 -1px 0 #d9dfd2;backdrop-filter:none}
      .studio-connected .mobile-nav-scroll{box-sizing:border-box;height:100%;max-height:var(--ios-nav-height);align-items:stretch}
      .studio-connected .app-header.studio-scroll-header{position:absolute;top:0;left:0;right:0;transition:transform .38s cubic-bezier(.22,.61,.36,1)}
      .studio-connected .page{padding-top:calc(78px + var(--safe-top,0px));scroll-padding-top:calc(58px + var(--safe-top,0px))}
      .studio-connected #page-home{padding-top:calc(72px + var(--safe-top,0px))!important}
      .studio-connected .app-header.studio-header-collapsed{transform:translateY(-100%);pointer-events:none}
      #conver-atelier .at-site-header.studio-scroll-header{position:sticky;top:0;z-index:40;background:#f7f6f2;transition:transform .38s cubic-bezier(.22,.61,.36,1)}
      #conver-atelier .at-site-header.studio-header-collapsed{transform:translateY(-100%);pointer-events:none}
      html.studio-scroll-header-document{scroll-padding-top:calc(var(--studio-mobile-header-height,160px) + 12px)}
      .studio-keyboard-open .app-header.studio-header-collapsed{transform:none}
    }
    @media(prefers-reduced-motion:reduce){.app-header.studio-scroll-header,#conver-atelier .at-site-header.studio-scroll-header{transition:none!important}}
    body.reducemotion .studio-scroll-header{transition:none!important}
  `;
  document.head.append(style);
  header.classList.add('studio-scroll-header');
  if (app) document.documentElement.classList.add('studio-scroll-app');
  if (!app) {
    document.documentElement.classList.add('studio-scroll-header-document');
    const measure = () => document.documentElement.style.setProperty('--studio-mobile-header-height', header.getBoundingClientRect().height + 'px');
    measure();
    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(header);
  }
  let hidden = false, scroller = null, previous = 0, travel = 0, direction = 0, frame = 0;
  function show() { setHidden(false); travel = 0; direction = 0; }
  function setHidden(next) {
    if (hidden === next) return;
    hidden = next;
    header.classList.toggle('studio-header-collapsed', next);
    header.inert = next || !!originalInert;
    if (next) header.setAttribute('aria-hidden', 'true');
    else if (originalAria === null) header.removeAttribute('aria-hidden');
    else header.setAttribute('aria-hidden', originalAria);
  }
  function locked() {
    const active = document.activeElement;
    return (header.contains(active) && active?.matches(':focus-visible')) || active?.matches('input,textarea,select,[contenteditable="true"]')
      || document.body.classList.contains('studio-keyboard-open')
      || document.querySelector('dialog[open], #user-dropdown.show, #user-dropdown.open')
      || (app && document.getElementById('auth-screen') && !document.getElementById('auth-screen').classList.contains('hidden'));
  }
  function update() {
    frame = 0;
    if (!mobile.matches || locked() || !scroller) { show(); return; }
    // Clamp rubber-band overscroll and viewport-induced bottom adjustments.
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const y = Math.max(0, Math.min(scroller.scrollTop, max));
    const delta = y - previous;
    const viewportClamp = previous > max && y === max;
    previous = y;
    if (y <= 16 || max <= 96) { show(); return; }
    if (viewportClamp) return;
    if (Math.abs(delta) < 1) return;
    const nextDirection = Math.sign(delta);
    if (nextDirection !== direction) travel = 0;
    direction = nextDirection;
    travel += Math.abs(delta);
    if (direction > 0 && y > 96 && travel >= 24) setHidden(true);
    else if (direction < 0 && travel >= 12) show();
  }
  function onScroll(event) {
    const target = event.target;
    const next = app ? (target?.matches?.('.page.active') ? target : null)
      : (target === document || target === window ? document.scrollingElement : null);
    if (!next) return; // Ignore chat logs, carousels, menus and other nested scrollers.
    if (scroller !== next) { scroller = next; previous = 0; travel = 0; direction = 0; }
    if (!frame) frame = requestAnimationFrame(update);
  }
  document.addEventListener('scroll', onScroll, {capture:true,passive:true});
  document.addEventListener('focusin', show);
  document.addEventListener('keydown', event => { if (event.key === 'Tab' || event.key === 'Escape') show(); });
  // Safari changes viewport height as its own toolbar collapses. That is not a
  // navigation event and must not cancel our scroll animation.
  let viewportWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === viewportWidth) return;
    viewportWidth = window.innerWidth;
    show(); previous = scroller?.scrollTop || 0;
  }, {passive:true});
  mobile.addEventListener?.('change', show);
  let currentPage = app?.querySelector('.page.active')?.id;
  if (app) {
    const routeObserver = new MutationObserver(() => {
      const id = app.querySelector('.page.active')?.id;
      if (id === currentPage) return;
      currentPage = id; scroller = null; previous = 0; show();
    });
    app.querySelectorAll('.page').forEach(page => routeObserver.observe(page, {attributes:true,attributeFilter:['class']}));
  }
})();
