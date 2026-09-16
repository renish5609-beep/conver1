const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
let source=fs.readFileSync(process.argv[2],'utf8');
const path=require('path');
source=source.replace('<script src="/studio-ui.js?v=5" defer></script>',()=>'<script>'+fs.readFileSync(path.resolve(path.dirname(process.argv[2]),'studio-ui.js'),'utf8')+'</script>');
const issues=[];const requests=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>issues.push(e.message));
const noop=()=>{};
const dom=new JSDOM(source,{url:'http://localhost:3000/app?auth=signin',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.matchMedia=()=>({matches:false,addListener:noop,removeListener:noop,addEventListener:noop});
 w.HTMLElement.prototype.scrollIntoView=noop;
 w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:()=>({width:30}),createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
 w.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
 w.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};
 w.fetch=async(url)=>{requests.push(String(url));return {ok:false,status:503,json:async()=>({error:'Test environment: no live backend'}),text:async()=>''}};
 w.supabase={createClient:()=>({auth:{onAuthStateChange:noop,getSession:async()=>({data:{session:null}})}})};
}});
setTimeout(async()=>{
 const w=dom.window,d=w.document,out=[];
 function check(name,action){try{action();out.push({name,pass:true})}catch(e){out.push({name,pass:false,error:e.message})}}
 check('Guest entry',()=>{d.querySelector('.auth-btn-guest').click();if(!d.querySelector('#auth-screen').classList.contains('hidden'))throw Error('Auth overlay remains')});
 for(const name of ['Blaze','Echo','Sage','Nova','Rex','Luna']){
  const button=d.querySelector('#vcp-'+name.toLowerCase());button.click();
  await new Promise(resolve=>setTimeout(resolve,0));
  check('SVG picker retains coach action '+name,()=>{const image=button.querySelector('.cp-init img');if(image?.getAttribute('src')!=='/coach-'+name.toLowerCase()+'.svg')throw Error('Wrong artwork');if(button.getAttribute('aria-pressed')!=='true'||d.querySelectorAll('#voice-coach-picker .active').length!==1)throw Error('Selection not exclusive');if(!d.querySelector('#voice-coach-avatar').classList.contains('coach-'+name.toLowerCase()))throw Error('Real avatar did not update');});
 }
 w.navTo('coldopen');
 for(const button of d.querySelectorAll('.scenario-cat-btn')){
  button.click();await new Promise(resolve=>setTimeout(resolve,0));
  check('Cold Open selection retains character '+button.dataset.cat,()=>{if(!d.querySelector('#coldopen-character-display #scenario-char-'+button.dataset.cat))throw Error('Character not rendered');if(button.getAttribute('aria-pressed')!=='true'||d.querySelectorAll('.scenario-cat-btn[aria-pressed=true]').length!==1)throw Error('Selection not exclusive');});
 }
 check('Approved overview replaces old hero',()=>{if(!d.querySelector('.studio-overview .at-liquid-ring'))throw Error('Preview ring missing');if(d.querySelector('#page-home>.home-hero'))throw Error('Old hero remains');if(d.querySelectorAll('.studio-overview .at-launch').length!==3)throw Error('Missing launch cards');});
 check('Real counters and score retained',()=>{for(const id of ['anim-sessions','anim-streak','anim-xp','anim-level','home-conver-score','score-ring'])if(d.querySelectorAll('#'+id).length!==1)throw Error('Missing or duplicate '+id);});
 for(const button of d.querySelectorAll('.studio-overview [data-studio-page]'))check('Concept action '+button.dataset.studioPage,()=>{button.click();const target=button.dataset.studioPage==='coaches'?'practice':button.dataset.studioPage;if(!d.querySelector('#page-'+target).classList.contains('active'))throw Error('Wrong destination');if(button.dataset.studioPage==='coaches'&&d.querySelector('#psub-coaches').style.display!=='block')throw Error('Coach tab not selected');});
 check('Sidebar coaches uses real selection screen',()=>{d.querySelector('.at-sidebar [data-page=profiles]').click();if(d.querySelector('#psub-coaches').style.display!=='block')throw Error('Coach screen missing');});
 check('Voice stage retains original start handler',()=>{const button=d.querySelector('.studio-voice-stage button[onclick="startVoiceSession()"]');if(!button)throw Error('Live-session button missing');const original=w.startVoiceSession;let invoked=0;try{w.startVoiceSession=()=>invoked++;button.click();if(invoked!==1)throw Error('Handler not called');}finally{w.startVoiceSession=original;}});
 for(const page of ['home','warmup','practice','voice','coldopen','insights','settings','contact'])check('Navigate '+page,()=>{w.navTo(page);if(!d.querySelector('#page-'+page).classList.contains('active'))throw Error('Page not active')});
 for(const page of ['debate','qbank','companion','realtime','coaches','practice'])check('Practice tab '+page,()=>{w.navTo('practice');w.switchPracticeTab(page);if(d.querySelector('#psub-'+page).style.display!=='block')throw Error('Tab panel hidden')});
 for(const page of ['skills','history','briefing','coachnotes'])check('Insights tab '+page,()=>{w.navTo('insights');w.switchInsightsTab(page);if(d.querySelector('#insights-tab-'+page).style.display!=='block')throw Error('Tab panel hidden')});
 // Exercise original callbacks with local fixtures, never live services.
 for(const name of ['Blaze','Echo','Sage','Nova','Rex','Luna'])check('Select coach '+name,()=>{
  w.selectCoach(name);
  if(!d.querySelector('#chip-coach').textContent.includes(name))throw Error('Coach chip not synchronized');
  if(d.querySelectorAll('#coach-profiles-grid .selected').length!==1)throw Error('Coach selection not exclusive');
 });
 w.navTo('settings');
 const preferences=[...d.querySelectorAll('#page-settings input,#page-settings select')].filter(el=>el.type!=='file');
 for(const control of preferences)check('Persist preference '+control.id,()=>{
  const wanted=control.type==='checkbox'?!control.checked:control.tagName==='SELECT'?control.options[control.options.length-1].value:'Studio test';
  if(control.type==='checkbox')control.checked=wanted;else control.value=wanted;
  control.dispatchEvent(new w.Event('change',{bubbles:true}));
  // Discard the in-DOM value, then restore it through the existing persistence code.
  if(control.type==='checkbox')control.checked=!wanted;else control.value='';
  w.applySettingsToUI();
  if((control.type==='checkbox'?control.checked:control.value)!==wanted)throw Error('Saved preference did not reload');
 });
 check('Reduced motion preference applied',()=>{if(!d.body.classList.contains('reducemotion'))throw Error('Motion class not applied')});
 check('Compact preference applied',()=>{if(!d.body.classList.contains('compact-mode'))throw Error('Compact class not applied')});
 check('Saved accent remains functional',()=>{w.setAccentColor('#38bdf8');if(d.documentElement.style.getPropertyValue('--accent')!=='#38bdf8')throw Error('Accent not applied')});
 for(const button of d.querySelectorAll('.studio-settings-nav button'))check('Settings category '+button.textContent,()=>{
  button.click();if(button.getAttribute('aria-pressed')!=='true')throw Error('Category not selected');
  if(![...d.querySelectorAll('#page-settings .settings-section-title')].some(title=>!title.closest('.panel').hidden))throw Error('No settings visible');
 });
 if(d.querySelector('.studio-settings-nav'))check('All settings remain reachable',()=>{
  d.querySelector('.studio-settings-nav button').click();
  if([...d.querySelectorAll('#page-settings .settings-section-title')].some(title=>title.closest('.panel').hidden))throw Error('A section was lost');
 });
 if(d.querySelector('.studio-settings-nav'))check('Preference accessible names',()=>{
  for(const input of preferences)if(!input.getAttribute('aria-label')&&!input.labels?.length)throw Error('Missing name '+input.id);
 });
 const analysis={composite:8,clarity:8,confidence:7,persuasion:9,storytelling:8,conciseness:7,overall:'Test assessment',strengths:['Specific example'],improvements:['Shorter closing'],rewrite:'Test rewritten answer',filler_feedback:'One pause',weak_skill:'Conciseness',weak_skill_tip:'Keep the closing focused'};
 check('Generated feedback renders five dimensions',()=>{w.renderResults(analysis,'This is a local fixture answer.');const text=d.querySelector('#results-area').textContent;for(const name of ['Clarity','Confidence','Persuasion','Storytelling','Conciseness'])if(!text.includes(name))throw Error('Missing score '+name);if(!text.includes('Test assessment'))throw Error('Assessment missing');});
 check('Session report opens with real renderer',()=>{w.openReport({scenario:'Interview',coach:'Luna',time:new w.Date(),question:'Test question',analysis});if(d.querySelector('#report-modal').classList.contains('hidden'))throw Error('Report hidden');if(d.querySelector('#rm-rewrite').textContent!=='Test rewritten answer')throw Error('Rewrite missing');});
 check('Session report closes',()=>{w.closeReport();if(!d.querySelector('#report-modal').classList.contains('hidden'))throw Error('Report stays open');});
 await new Promise(resolve=>setTimeout(resolve,0));
 if(d.querySelector('.studio-settings-nav'))check('Dynamic coach cards support keyboard',()=>{const card=d.querySelector('#coach-profiles-grid .coach-profile-card');if(card.tabIndex!==0||card.getAttribute('role')!=='button')throw Error('Keyboard affordance missing');card.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));if(!d.querySelector('#chip-coach').textContent.includes('Blaze'))throw Error('Keyboard did not select coach');});
 check('Share progress dialog',()=>{w.openShareModal();if(d.querySelector('#share-modal').classList.contains('hidden'))throw Error('Dialog hidden')});
 await new Promise(resolve=>setTimeout(resolve,100));
 check('Overview coach tracks real selection',()=>{if(d.querySelector('.studio-overview .at-selected-name').textContent!==d.querySelector('#home-coach').textContent)throw Error('Coach name diverged');});
 const actionableIssues=[...new Set(issues)];
 console.log(JSON.stringify({checks:out,issues:actionableIssues,requests:[...new Set(requests)]},null,2));w.close(); if(out.some(test=>!test.pass)||actionableIssues.length)process.exitCode=1;
},250);
