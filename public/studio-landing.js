
(()=>{
 const root=document.getElementById('conver-atelier');
 const card=root.querySelector('.at-example-feedback');
 const quote=card.querySelector('p'),byline=card.querySelector(':scope > span');
 const samples=[
  ['Blaze','Interview Coach','Strong opening. Your confidence is there — now sharpen the close.'],
  ['Echo','Conversation Coach','That felt honest. Leave a little space after your question and let them in.'],
  ['Sage','Communication Coach','Your reasoning is clear. One concrete example will make the idea land.'],
  ['Nova','Pitch Coach','There’s energy in that idea. Lead with the boldest part, then show us why.'],
  ['Rex','Interview Coach','Cut the setup. State what you did, give the result, then stop.'],
  ['Luna','Conversation Coach','Take a breath. You don’t need a perfect answer — start with what you mean.']
 ];
 const controls=document.createElement('div');controls.className='at-quote-controls';
 const pause=document.createElement('button'),next=document.createElement('button');
 for(const button of [pause,next]){button.type='button';button.className='cursor-interaction';controls.append(button);}
 next.textContent='Next coach';card.append(controls);
 const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 let paused=preference.matches,current=0,bag=[],changing=false,hovered=false;
 const updatePause=()=>{pause.textContent=paused?'Play quotes':'Pause quotes';pause.setAttribute('aria-pressed',String(paused));};updatePause();
 function refill(){bag=samples.map((_,i)=>i).filter(i=>i!==current);for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 function advance(manual=false){
  if(changing)return;
  if(!bag.length)refill();
  const chosen=bag.shift();changing=true;
  const noMotion=preference.matches||root.classList.contains('at-less-motion');
  if(!noMotion)card.classList.add('at-quote-changing');
  setTimeout(()=>{current=chosen;quote.textContent='“'+samples[current][2]+'”';byline.textContent=samples[current][0]+' · '+samples[current][1];card.classList.remove('at-quote-changing');changing=false;},noMotion?0:220);
 }
 pause.addEventListener('click',()=>{paused=!paused;updatePause();});next.addEventListener('click',()=>advance(true));
 card.addEventListener('mouseenter',()=>hovered=true);card.addEventListener('mouseleave',()=>hovered=false);
 if(preference.addEventListener)preference.addEventListener('change',event=>{if(event.matches){paused=true;updatePause();}});
 setInterval(()=>{if(paused||hovered||changing||document.hidden||root.classList.contains('at-less-motion')||root.querySelector('[data-public-view="landing"]').hidden||card.contains(document.activeElement))return;advance();},6000);
})();

(()=>{
 const root=document.getElementById('conver-atelier');
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const words=['the interview.','the big idea.','the hard conversation.','the moment that matters.'];
 let index=0,letters=words[0].length,deleting=true,hold=24;
 setInterval(()=>{if(media.matches||document.hidden)return;if(hold>0){hold--;return;}if(deleting){letters--;if(letters===0){deleting=false;index=(index+1)%words.length;hold=3;}}else{letters++;if(letters===words[index].length){deleting=true;hold=24;}}root.querySelector('#at-site-typeword').textContent=words[index].slice(0,letters);},90);
 root.querySelectorAll('[data-public-coach]').forEach(button=>button.addEventListener('click',()=>{root.querySelectorAll('[data-public-coach]').forEach(other=>{other.classList.toggle('selected',other===button);other.setAttribute('aria-pressed',String(other===button));});root.querySelector('#at-site-coach-name').textContent=button.dataset.publicCoach;root.querySelector('#at-site-coach-style').textContent=button.dataset.coachStyle;root.querySelector('.at-detail-avatar').textContent=button.dataset.publicCoach[0];}));
 if(!media.matches&&typeof IntersectionObserver!=='undefined'){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('at-pending');observer.unobserve(entry.target);}}),{threshold:.06});root.querySelectorAll('.at-reveal').forEach(el=>{el.classList.add('at-pending');observer.observe(el);});media.addEventListener('change',event=>{if(event.matches){observer.disconnect();root.querySelectorAll('.at-pending').forEach(el=>el.classList.remove('at-pending'));}});}
})();
