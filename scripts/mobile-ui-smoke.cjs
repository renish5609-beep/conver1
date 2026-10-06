// Responsive cascade and real navigation/keyboard regression checks.
// npm install --prefix ../checks jsdom css-tree css-mediaquery
// NODE_PATH=../checks/node_modules node scripts/mobile-ui-smoke.cjs
// This is not a substitute for Safari/WKWebView testing on physical hardware.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require('jsdom');
const tree = require('css-tree');
const media = require('css-mediaquery');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'public', file), 'utf8');
const original = read('index.html');
const ui = read('studio-ui.js');
const source = original.replace(/<script src="\/studio-ui\.js\?v=\d+" defer><\/script>/, () => '<script>' + ui + '</script>')
  .replace('<script src="/studio-header.js?v=3" defer></script>', () => '<script>' + read('studio-header.js') + '</script>');
const errors = [], requests = [];
const vc = new VirtualConsole();
vc.on('jsdomError', error => errors.push(error.message));
const noop = () => {};
const wait = () => new Promise(resolve => setTimeout(resolve, 45));
let features = {type:'screen',width:'390px',height:'844px',pointer:'coarse','prefers-reduced-motion':'no-preference'};
const dom = new JSDOM(source, {
  url:'https://conver.test/app?auth=signin', runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(w) {
    w.innerWidth = 390; w.innerHeight = 844;
    w.matchMedia = query => ({get matches(){return media.match(query, features)},addEventListener:noop,addListener:noop,removeListener:noop});
    w.HTMLElement.prototype.scrollIntoView = noop;
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({measureText:()=>({width:30}),createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
    w.ResizeObserver = class {observe(){} disconnect(){}};
    w.IntersectionObserver = class {observe(){} disconnect(){}};
    w.fetch = async url => {requests.push(String(url));return {ok:false,status:503,json:async()=>({error:'Offline fixture'}),text:async()=>''};};
    w.supabase = {createClient:()=>({auth:{onAuthStateChange:noop,getSession:async()=>({data:{session:null}})}})};
    w.visualViewport = Object.assign(new w.EventTarget(), {height:844,width:390,scale:1});
    w.HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','')};
    w.HTMLDialogElement.prototype.close = function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'))};
  }
});
const w = dom.window, d = w.document;
let checks = 0;
function check(name, test) { test(); checks++; }
function cssFor(html) {
  const snippets = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match=>match[1]);
  for (const match of html.matchAll(/<link[^>]+href="\/([^"?]+\.css)(?:\?[^" ]+)?"[^>]*>/g)) snippets.push(read(match[1]));
  return tree.parse(snippets.join('\n'));
}
function responsiveCss(ast) {
  const rules = [];
  const walk = list => list.forEach(node => {
    if (node.type === 'Rule') rules.push(tree.generate(node));
    else if (node.type === 'Atrule' && node.name === 'media' && media.match(tree.generate(node.prelude),features)) walk(node.block.children);
    // The checks use modern supported properties outside optional @supports.
  });
  walk(ast.children);
  return rules.join('\n');
}
(async () => {
  await wait();
  check('auth isolates the app from keyboard/VoiceOver focus',()=>assert.equal(d.querySelector('.app').inert,true));
  d.querySelector('.auth-btn-guest').click(); await wait();
  check('guest entry restores app interactivity',()=>assert.equal(d.querySelector('.app').inert,false));
  const header=d.querySelector('.app-header'), home=d.querySelector('#page-home');
  Object.defineProperty(home,'scrollHeight',{configurable:true,value:2000});
  Object.defineProperty(home,'clientHeight',{configurable:true,value:600});
  const scroll=async y=>{home.scrollTop=y;home.dispatchEvent(new w.Event('scroll'));await wait()};
  await scroll(70);
  check('header remains visible near the page top',()=>assert.equal(header.classList.contains('studio-header-collapsed'),false));
  await scroll(150);
  check('downward page scroll collapses header and removes hidden controls from focus',()=>{assert.ok(header.classList.contains('studio-header-collapsed'));assert.equal(header.inert,true);assert.equal(header.getAttribute('aria-hidden'),'true')});
  w.dispatchEvent(new w.Event('resize'));await wait();
  check('Safari toolbar height changes do not reveal the collapsed header',()=>assert.ok(header.classList.contains('studio-header-collapsed')));
  check('header animation uses transform without resizing the scroller',()=>{const s=read('studio-header.js');assert.ok(s.includes('transition:transform .38s'));assert.equal(s.includes('margin-bottom'),false);assert.ok(s.includes('position:absolute;top:0'));assert.ok(s.includes('#page-home{padding-top:calc(72px'))});
  check('mobile navigation belongs to the app viewport and safe-area background',()=>{const s=read('studio-header.js');assert.ok(s.includes('.mobile-nav{position:absolute;bottom:0;background:#f7f6f2'));assert.ok(s.includes('.studio-connected.app{position:fixed;top:0'));assert.ok(s.includes('max-height:var(--ios-nav-height)'));assert.ok(d.documentElement.classList.contains('studio-scroll-app'))});
  await scroll(170);await scroll(162);
  check('small upward movement does not flicker the header',()=>assert.ok(header.classList.contains('studio-header-collapsed')));
  await scroll(145);
  check('intentional upward scrolling restores header',()=>{assert.equal(header.classList.contains('studio-header-collapsed'),false);assert.equal(header.inert,false);assert.equal(header.getAttribute('aria-hidden'),null)});
  await scroll(220);await scroll(-20);
  check('rubber-band overscroll at the top restores header',()=>assert.equal(header.classList.contains('studio-header-collapsed'),false));
  await scroll(250);
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
  check('keyboard navigation restores hidden header controls',()=>assert.equal(header.inert,false));
  await scroll(1390);Object.defineProperty(home,'clientHeight',{configurable:true,value:700});await scroll(1300);
  check('header collapse at page bottom does not trigger a reveal loop',()=>assert.ok(header.classList.contains('studio-header-collapsed')));
  Object.defineProperty(home,'clientHeight',{configurable:true,value:600});
  await scroll(300);w.navTo('practice');await wait();
  check('changing routes restores header',()=>assert.equal(header.classList.contains('studio-header-collapsed'),false));
  w.navTo('home');await wait();home.scrollTop=0;
  const nested=d.createElement('div');home.append(nested);nested.scrollTop=500;nested.dispatchEvent(new w.Event('scroll'));await wait();
  check('nested scroll areas do not collapse the main header',()=>assert.equal(header.classList.contains('studio-header-collapsed'),false));nested.remove();
  const publicHeaderDoc = new JSDOM('<main id="conver-atelier"><header class="at-site-header"><a href="#section">Features</a></header><section id="section"></section></main>',{
    runScripts:'dangerously',pretendToBeVisual:true,beforeParse(p){p.matchMedia=()=>({matches:true,addEventListener:noop});}
  });
  const pd=publicHeaderDoc.window.document, ph=pd.querySelector('header'), ps=pd.documentElement;
  Object.defineProperty(pd,'scrollingElement',{value:ps});Object.defineProperty(ps,'scrollHeight',{value:2000});Object.defineProperty(ps,'clientHeight',{value:600});
  publicHeaderDoc.window.eval(read('studio-header.js'));
  ps.scrollTop=250;pd.dispatchEvent(new publicHeaderDoc.window.Event('scroll'));await wait();
  check('public landing header collapses on document scroll',()=>assert.ok(ph.classList.contains('studio-header-collapsed')));
  ps.scrollTop=220;pd.dispatchEvent(new publicHeaderDoc.window.Event('scroll'));await wait();
  check('public landing header returns on upward document scroll',()=>assert.equal(ph.inert,false));
  publicHeaderDoc.window.close();
  for (const icon of ['\u26a0\ufe0f','\u2b07','\u2713','\u2715']) {
    w.showToast(icon, 'Status message');
    check('toast uses a vector indicator for '+JSON.stringify(icon),()=>{
      assert.ok(d.querySelector('#toast-icon svg'));
      assert.equal(d.querySelector('#toast-msg').textContent,'Status message');
    });
  }
  for (const id of ['debate-mic-btn','co-mic-btn']) {
    const button = d.getElementById(id);
    button.className='hold-btn processing';button.disabled=true;button.textContent='\u23f3';await wait();
    check('processing '+id+' is emoji-free without changing disabled state',()=>{
      assert.ok(button.querySelector('.studio-progress-spinner'));
      assert.equal(button.disabled,true);assert.equal(button.textContent,'Processing');
    });
    button.className='hold-btn idle';button.disabled=false;button.textContent='○';await wait();
    check('processing indicator clears on return to idle '+id,()=>assert.equal(button.querySelector('.studio-progress-spinner'),null));
  }
  const badge=d.getElementById('rt-eye-badge');badge.textContent='\u23f3 Calibrating... 42%';await wait();
  check('calibration retains progress without the emoji',()=>assert.equal(badge.textContent,'Calibrating... 42%'));
  const more = d.querySelector('.studio-mobile-more'), menu = d.querySelector('#studio-mobile-menu');
  const expected = {warmup:'warmup',coldopen:'coldopen',profiles:'practice',settings:'settings',contact:'contact'};
  for (const [destination,page] of Object.entries(expected)) {
    more.click();
    check('More opens with accessible state',()=>{assert.ok(menu.open);assert.equal(more.getAttribute('aria-expanded'),'true')});
    menu.querySelector('[data-destination="'+destination+'"]').click(); await wait();
    check('More reaches '+destination,()=>{assert.ok(d.querySelector('#page-'+page).classList.contains('active'));assert.equal(menu.open,false);assert.equal(more.getAttribute('aria-expanded'),'false')});
  }
  check('guest support email stays editable and empty',()=>assert.equal(d.querySelector('#cf-email').value,''));
  more.click();
  const close = menu.querySelector('.studio-mobile-menu-close');
  close.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
  check('sheet traps backward focus',()=>assert.equal(d.activeElement,menu.querySelector('[data-destination="contact"]')));
  menu.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  check('Escape closes sheet and restores focus',()=>{assert.equal(menu.open,false);assert.equal(d.activeElement,more)});
  for (const destination of ['home','practice','voice','insights']) {
    d.querySelector('.mnav-btn[data-page="'+destination+'"]').click(); await wait();
    check('primary route '+destination,()=>{assert.ok(d.querySelector('#page-'+destination).classList.contains('active'));assert.equal(more.classList.contains('active'),false);assert.equal(d.querySelector('.mnav-btn[data-page="'+destination+'"]').getAttribute('aria-current'),'page')});
  }
  w.navTo('contact'); await wait();
  const email = d.querySelector('#cf-email');
  email.focus(); w.visualViewport.height = 510; w.visualViewport.dispatchEvent(new w.Event('resize')); await wait();
  check('Safari keyboard resizes available app height',()=>{assert.equal(d.documentElement.style.getPropertyValue('--studio-viewport-height'),'510px');assert.ok(d.body.classList.contains('studio-keyboard-open'))});
  w.visualViewport.height = 844; w.visualViewport.dispatchEvent(new w.Event('resize')); await wait();
  check('keyboard dismissal restores navigation space',()=>assert.equal(d.body.classList.contains('studio-keyboard-open'),false));
  w.dispatchEvent(new w.CustomEvent('keyboardWillShow',{detail:{keyboardHeight:320}})); await wait();
  check('Capacitor body resize mode has a viewport fallback',()=>assert.equal(d.documentElement.style.getPropertyValue('--studio-viewport-height'),'524px'));
  w.dispatchEvent(new w.Event('keyboardDidHide')); await wait();
  check('native keyboard close restores height',()=>assert.equal(d.documentElement.style.getPropertyValue('--studio-viewport-height'),'844px'));
  w.visualViewport.scale = 2; w.visualViewport.height = 422; w.visualViewport.dispatchEvent(new w.Event('resize')); await wait();
  check('pinch zoom does not masquerade as keyboard',()=>{assert.equal(d.body.classList.contains('studio-keyboard-open'),false);assert.equal(d.documentElement.style.getPropertyValue('--studio-viewport-height'),'844px')});
  w.visualViewport.scale = 1; w.visualViewport.height = 844;

  const appAst = cssFor(original), landingAst = cssFor(read('landing.html')), legalAst = cssFor(read('privacy.html'));
  d.querySelectorAll('style').forEach(style=>style.remove());
  const style = d.createElement('style'); d.head.append(style);
  const styleOf = selector => w.getComputedStyle(d.querySelector(selector));
  for (const [width,height,pointer] of [[320,568,'coarse'],[390,844,'coarse'],[430,932,'coarse'],[764,900,'coarse'],[844,390,'coarse'],[768,1024,'coarse'],[1440,900,'fine']]) {
    features = {type:'screen',width:width+'px',height:height+'px',pointer,'prefers-reduced-motion':'no-preference'};
    const phone = width <= 767 || height <= 500 && pointer === 'coarse';
    style.textContent = responsiveCss(appAst);
    check('responsive navigation at '+width+'×'+height,()=>{
      assert.equal(styleOf('.app-tabs-wrap').display,phone?'none':'block');
      assert.equal(styleOf('#mobile-nav').display,phone?'block':'none');
      if (phone) {
        const visible = [...d.querySelectorAll('.mnav-btn')].filter(button=>w.getComputedStyle(button).display!=='none');
        assert.equal(visible.length,5);
        for(const button of visible) assert.ok(parseFloat(w.getComputedStyle(button).minHeight)>=44);
        assert.equal(styleOf('.toggle').height,'44px');
        assert.equal(styleOf('#cf-email').fontSize,'16px');
      }
    });
    for (const [name,ast,html] of [['landing',landingAst,read('landing.html')],['privacy',legalAst,read('privacy.html')]]) {
      const publicDoc = new JSDOM(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<style[^>]*>[\s\S]*?<\/style>/g,''));
      const sheet = publicDoc.window.document.createElement('style'); sheet.textContent = responsiveCss(ast); publicDoc.window.document.head.append(sheet);
      check(name+' document scrolling at '+width,()=>{
        for (const element of [publicDoc.window.document.documentElement,publicDoc.window.document.body]) {
          const computed = publicDoc.window.getComputedStyle(element);
          assert.notEqual(computed.overflow,'hidden'); assert.notEqual(computed.overflowY,'hidden');
        }
      });
      publicDoc.window.close();
    }
  }
  features = {type:'screen',width:'390px',height:'844px',pointer:'coarse','prefers-reduced-motion':'reduce'};
  style.textContent = responsiveCss(appAst);more.click();
  check('reduced motion disables the sheet animation',()=>assert.equal(styleOf('#studio-mobile-menu').animation,'none'));
  features.width='1440px';features.height='900px';w.innerWidth=1440;w.innerHeight=900;w.dispatchEvent(new w.Event('resize'));await wait();
  check('returning to desktop clears mobile viewport and dismisses sheet',()=>{assert.equal(menu.open,false);assert.equal(d.documentElement.style.getPropertyValue('--studio-viewport-height'),'')});
  assert.deepEqual(errors,[]);
  assert.ok(!requests.some(url=>/\/api\/(speak|scribe-token)/.test(url)),'Navigation unexpectedly started speech');
  console.log(checks+' mobile QA checks passed: routes, focus, keyboard events, responsive cascade (320–1440px), scrolling, reduced motion; all network requests stubbed.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>w.close());
