const fs=require('fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const path=require('path');const root=path.resolve(__dirname,'..');
let intervals=[],errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
let source=fs.readFileSync(path.join(root,'public/landing.html'),'utf8');
source=source.replace('<script src="/studio-landing.js?v=4" defer></script>','<script>'+fs.readFileSync(path.join(root,'public/studio-landing.js'),'utf8')+'</script>');
const dom=new JSDOM(source,{url:'http://localhost:4173/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){}});w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length};w.setTimeout=fn=>{fn();return 1};}});
const d=dom.window.document;
try{
 assert.equal(d.querySelectorAll('.at-site-feature').length,6);
 assert.equal(d.querySelectorAll('.at-site-step').length,4);
 assert.equal(d.querySelectorAll('[data-public-coach]').length,6);
 assert.ok(d.querySelector('.studio-public-transition .studio-public-transition-mark'));
 for(const button of d.querySelectorAll('[data-public-coach]')){const img=button.querySelector('.at-site-coach-art img');assert.ok(img);assert.ok(fs.existsSync(path.join(root,'public',img.getAttribute('src'))));button.click();assert.equal(d.querySelector('.at-detail-avatar img').getAttribute('src'),img.getAttribute('src'));}
 assert.equal(d.querySelector('.at-site-header-actions .at-text-button').getAttribute('href'),'/app?auth=signin');
 assert.ok(d.querySelector('.at-site-type-line .at-type-cursor'));
 const initialWord=d.querySelector('#at-site-typeword').textContent;const type=intervals.find(x=>x.ms===90).fn;for(let i=0;i<30;i++)type();assert.notEqual(d.querySelector('#at-site-typeword').textContent,initialWord);
 for(const button of d.querySelectorAll('[data-public-coach]')){button.click();assert.equal(d.querySelector('#at-site-coach-name').textContent,button.dataset.publicCoach);assert.equal(d.querySelectorAll('[data-public-coach][aria-pressed=true]').length,1);}
 for(const a of d.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(href.startsWith('#'))assert.ok(d.getElementById(href.slice(1)));else if(href.startsWith('/')){const pathname=new URL(href,'https://conver.test').pathname;if(pathname!=='/'&&pathname!=='/app')assert.ok(fs.existsSync(path.join(root,'public',pathname)));else if(pathname==='/app')assert.match(href,/\?auth=(signin|signup)$/);}}
 const card=d.querySelector('.at-example-feedback'),byline=card.querySelector(':scope>span'),buttons=card.querySelectorAll('button');let seen=new Set([byline.textContent.split(' · ')[0]]);
 for(let i=0;i<5;i++){buttons[1].click();seen.add(byline.textContent.split(' · ')[0]);}assert.equal(seen.size,6);
 const rotate=intervals.find(x=>x.ms===6000).fn;let before=byline.textContent;buttons[0].click();rotate();assert.equal(byline.textContent,before);buttons[0].click();rotate();assert.notEqual(byline.textContent,before);
 assert.deepEqual(errors,[]);
 console.log('Landing smoke passed: content, six coaches, links, quote shuffle, pause/resume, no runtime errors.');
}finally{dom.window.close();}
