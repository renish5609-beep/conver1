
(()=>{
 const root=document.getElementById('conver-atelier');
 const card=root.querySelector('.at-example-feedback');
 const quote=card.querySelector('p'),byline=card.querySelector(':scope > span');
 const samples=[
  ['Blaze','Interview Coach','Strong opening. Your confidence is there — now sharpen the close.'],
  ['Blaze','Interview Coach','Own the first sentence. Make the room catch up to your certainty.'],
  ['Blaze','Interview Coach','You have the proof. Deliver it earlier and let the result do the work.'],
  ['Echo','Conversation Coach','That felt honest. Leave a little space after your question and let them in.'],
  ['Echo','Conversation Coach','You listened for the words. Now listen for what changed underneath them.'],
  ['Echo','Conversation Coach','Keep that warmth. A shorter response will give the other person room to meet it.'],
  ['Sage','Communication Coach','Your reasoning is clear. One concrete example will make the idea land.'],
  ['Sage','Communication Coach','Lead with the principle, then use one detail to make it undeniable.'],
  ['Sage','Communication Coach','The thought is strong. Slow the middle so every step feels inevitable.'],
  ['Nova','Pitch Coach','There’s energy in that idea. Lead with the boldest part, then show us why.'],
  ['Nova','Pitch Coach','The vision is alive. Give it one vivid image people can repeat tomorrow.'],
  ['Nova','Pitch Coach','Raise the stakes sooner. Let them feel why this idea has to exist now.'],
  ['Rex','Interview Coach','Cut the setup. State what you did, give the result, then stop.'],
  ['Rex','Interview Coach','Drop the qualifier. You earned the outcome — say it cleanly.'],
  ['Rex','Interview Coach','Answer the question in ten words first. Everything after that has to earn its place.'],
  ['Luna','Conversation Coach','Take a breath. You don’t need a perfect answer — start with what you mean.'],
  ['Luna','Conversation Coach','Your pause is not empty. Use it to choose the honest sentence.'],
  ['Luna','Conversation Coach','Stay with the feeling for one beat longer, then say what you need.']
 ];
 const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 let current=0,bag=[],changing=false;
 card.setAttribute('aria-live','polite');
 function refill(){bag=samples.map((_,i)=>i).filter(i=>i!==current);for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}
 function advance(){
  if(changing)return;
  if(!bag.length)refill();
  const chosen=bag.shift();changing=true;
  const noMotion=preference.matches||root.classList.contains('at-less-motion');
  if(!noMotion)card.classList.add('at-quote-changing');
  setTimeout(()=>{current=chosen;quote.textContent='“'+samples[current][2]+'”';byline.textContent=samples[current][0]+' · '+samples[current][1];card.classList.remove('at-quote-changing');changing=false;},noMotion?0:220);
 }
 setInterval(()=>{if(changing||document.hidden)return;advance();},5200);
})();

// Carry the same Conver transition from the public site into authentication.
(()=>{
 const layer=document.createElement('div');layer.className='studio-public-transition';layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<div><span class="studio-public-transition-mark"><img src="/brand-mark.svg" alt=""></span><strong>conver<i>.</i></strong><span class="studio-public-transition-wave" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></span><small>OPENING YOUR STUDIO</small></div>';
 document.body.append(layer);
 const status=layer.querySelector('small');
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;const raw=link.getAttribute('href');if(!raw||raw.startsWith('#')||raw.startsWith('mailto:')||raw.startsWith('tel:'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.href===location.href)return;event.preventDefault();status.textContent=url.pathname==='/app'?'OPENING SIGN IN':'OPENING DETAILS';layer.classList.add('active');layer.setAttribute('aria-hidden','false');setTimeout(()=>location.assign(url.href),390);},true);
})();

(()=>{
 const root=document.getElementById('conver-atelier');
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const words=['the interview.','the big idea.','the hard conversation.','the moment that matters.'];
 let index=0,letters=words[0].length,deleting=true,hold=24;
 setInterval(()=>{if(media.matches||document.hidden)return;if(hold>0){hold--;return;}if(deleting){letters--;if(letters===0){deleting=false;index=(index+1)%words.length;hold=3;}}else{letters++;if(letters===words[index].length){deleting=true;hold=24;}}root.querySelector('#at-site-typeword').textContent=words[index].slice(0,letters);},90);
 root.querySelectorAll('[data-public-coach]').forEach(button=>button.addEventListener('click',()=>{root.querySelectorAll('[data-public-coach]').forEach(other=>{other.classList.toggle('selected',other===button);other.setAttribute('aria-pressed',String(other===button));});root.querySelector('#at-site-coach-name').textContent=button.dataset.publicCoach;root.querySelector('#at-site-coach-style').textContent=button.dataset.coachStyle;root.querySelector('.at-detail-avatar').replaceChildren(button.querySelector('.at-site-coach-art img').cloneNode(true));}));
 if(!media.matches&&typeof IntersectionObserver!=='undefined'){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('at-pending');observer.unobserve(entry.target);}}),{threshold:.06});root.querySelectorAll('.at-reveal').forEach(el=>{el.classList.add('at-pending');observer.observe(el);});media.addEventListener('change',event=>{if(event.matches){observer.disconnect();root.querySelectorAll('.at-pending').forEach(el=>el.classList.remove('at-pending'));}});}
})();
