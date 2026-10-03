const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');

const root=path.resolve(__dirname,'..');
const css=name=>fs.readFileSync(path.join(root,'public',name),'utf8');
const dom=new JSDOM(`<!doctype html><style>${css('studio.css')}\n${css('studio-concept.css')}\n${css('studio-connected.css')}\n${css('studio-plasma.css')}\n${css('studio-sharp.css')}</style>
  <main class="studio-connected">
    <button id="button">Practice</button>
    <section id="panel" class="panel">Panel</section>
    <article id="runtime" style="border-radius:24px">Runtime card</article>
    <button id="hold" class="hold-btn" style="border-radius:24px">Talk</button>
    <div id="rt-dot-inner" style="width:16px;height:16px;border-radius:50%"></div>
    <div id="sp-avatar" style="width:72px;height:72px;border-radius:50%">A</div><button id="avatar-edit" style="border-radius:50%">Edit</button>
    <section id="psub-debate"><div id="debate-setup-screen">Debate</div></section>
    <section id="coldopen-setup"><button class="scenario-cat-btn">Interview</button></section>
    <section id="page-insights"><div></div><div><button class="insights-tab-btn">Skills</button></div></section>
    <section id="psub-qbank"><div></div><div><div><div class="panel">Categories</div></div><article class="qb-item">Question</article></div></section>
  </main>`);
const d=dom.window.document;
const radius=selector=>dom.window.getComputedStyle(d.querySelector(selector)).borderRadius;

assert.equal(radius('#button'),'2px','buttons must use precision corners');
assert.equal(radius('#panel'),'5px','primary panels must use architectural corners');
assert.equal(radius('#runtime'),'3px','runtime cards must not restore legacy rounding');
assert.equal(radius('#hold'),'50%','microphone control must remain deliberately circular');
assert.equal(radius('#rt-dot-inner'),'50%','camera target must remain deliberately circular');
assert.equal(radius('#sp-avatar'),'50%','profile avatar must remain deliberately circular');
assert.equal(radius('#avatar-edit'),'50%','avatar action must remain deliberately circular');
assert.equal(radius('#debate-setup-screen'),'5px','Debate must obey the shared surface system');
assert.equal(radius('#coldopen-setup'),'5px','Cold Open must obey the shared surface system');
assert.equal(radius('#coldopen-setup .scenario-cat-btn'),'5px','scenario cards must stay sharp');
assert.equal(radius('#page-insights .insights-tab-btn'),'5px','Insights tabs must stay sharp');
assert.equal(radius('#psub-qbank .panel'),'5px','Question Bank navigation must stay sharp');
assert.equal(radius('#psub-qbank .qb-item'),'5px','Question Bank rows must stay sharp');

const publicDom=new JSDOM(`<!doctype html><style>${css('studio-landing.css')}\n${css('studio-sharp.css')}</style>
  <div id="conver-atelier"><main class="at-public">
    <a id="cta" class="at-button at-button-ink">Start</a>
    <article id="feature" class="at-site-feature">Feature</article>
    <div class="at-site-rings"><div id="ring"></div></div>
  </main></div>`);
const publicStyle=selector=>publicDom.window.getComputedStyle(publicDom.window.document.querySelector(selector)).borderRadius;
assert.equal(publicStyle('#cta'),'2px','landing calls to action must use precision corners');
assert.equal(publicStyle('#feature'),'5px','landing cards must use architectural corners');
assert.equal(publicStyle('#ring'),'50%','brand orbit must remain deliberately circular');

console.log('Sharp UI smoke passed: controls, app surfaces, runtime cards, feature areas and intentional circles retain the precision system.');
dom.window.close();
publicDom.window.close();
