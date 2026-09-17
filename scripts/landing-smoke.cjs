const fs=require('fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const path=require('path');const root=path.resolve(__dirname,'..');
let intervals=[],errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
let source=fs.readFileSync(path.join(root,'public/landing.html'),'utf8');
source=source.replace('<script src="/studio-landing.js?v=7" defer></script>','<script>'+fs.readFileSync(path.join(root,'public/studio-landing.js'),'utf8')+'</script>');
const dom=new JSDOM(source,{url:'http://localhost:4173/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true'};w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length};w.setTimeout=fn=>{fn();return 1};}});
const d=dom.window.document;
try{
 assert.equal(d.querySelectorAll('.at-site-feature').length,6);
 assert.equal(d.querySelectorAll('.at-site-step').length,4);
 assert.equal(d.querySelectorAll('[data-public-coach]').length,6);
 assert.equal(d.querySelectorAll('.studio-public-transition .studio-speaker').length,2);
 assert.ok(d.querySelector('.studio-public-transition .studio-dialogue-signal'));
 for(const button of d.querySelectorAll('[data-public-coach]')){const img=button.querySelector('.at-site-coach-art img');assert.ok(img);assert.ok(fs.existsSync(path.join(root,'public',img.getAttribute('src'))));button.click();assert.equal(d.querySelector('.at-detail-avatar img').getAttribute('src'),img.getAttribute('src'));}
 assert.equal(d.querySelector('.at-site-header-actions .at-text-button').getAttribute('href'),'/app?auth=signin');
 assert.ok(d.querySelector('.at-site-type-line .at-type-cursor'));
 assert.ok(d.querySelectorAll('.at-scroll-reveal').length>20);
 const howLink=d.querySelector('a[href="#at-site-how"]');howLink.click();assert.equal(dom.window.location.hash,'#at-site-how');assert.equal(d.getElementById('at-site-how').dataset.scrolled,'true');
 const initialWord=d.querySelector('#at-site-typeword').textContent;const type=intervals.find(x=>x.ms===90).fn;for(let i=0;i<30;i++)type();assert.notEqual(d.querySelector('#at-site-typeword').textContent,initialWord);
 for(const button of d.querySelectorAll('[data-public-coach]')){button.click();assert.equal(d.querySelector('#at-site-coach-name').textContent,button.dataset.publicCoach);assert.equal(d.querySelectorAll('[data-public-coach][aria-pressed=true]').length,1);}
 for(const a of d.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(href.startsWith('#'))assert.ok(d.getElementById(href.slice(1)));else if(href.startsWith('/')){const pathname=new URL(href,'https://conver.test').pathname;if(pathname!=='/'&&pathname!=='/app')assert.ok(fs.existsSync(path.join(root,'public',pathname)));else if(pathname==='/app')assert.match(href,/\?auth=(signin|signup)$/);}}
 const card=d.querySelector('.at-example-feedback'),quote=card.querySelector('p'),byline=card.querySelector(':scope>span');assert.equal(card.querySelectorAll('button').length,0);assert.equal(card.getAttribute('aria-live'),'polite');
 const rotate=intervals.find(x=>x.ms===5200).fn;let seen=new Set([byline.textContent+'|'+quote.textContent]);for(let i=0;i<17;i++){rotate();seen.add(byline.textContent+'|'+quote.textContent);}assert.equal(seen.size,18);const before=byline.textContent+'|'+quote.textContent;rotate();assert.notEqual(byline.textContent+'|'+quote.textContent,before);
 assert.deepEqual(errors,[]);
 console.log('Landing smoke passed: content, six coaches, links, continuous 18-quote shuffle, no runtime errors.');
}finally{dom.window.close();}
