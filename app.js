import {createRoom} from './raum.js';
import {createMobileSteps} from './mobile-steuerung.js';

const $=selector=>document.querySelector(selector);
const root=document.documentElement;
const sceneElement=$('#scene');
const loader=$('.room-loader');
const textToggle=$('.text-toggle');
const journey=$('.scroll-journey');
const hud=$('.room-hud');
const detail=$('.detail-dialog');
const privacy=$('.privacy-dialog');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const mobile=matchMedia('(max-width: 720px)');
let room=null,active=0,flat=false,bright=false,data;
let steppedMode=false,touchingRoom=false;
const mobileSteps=createMobileSteps({
  isMoving:()=>room?.isMoving()??false,
  move(direction){const next=Math.max(0,Math.min(6,active+direction));if(next===active)return false;goTo(next);return true;}
});
const labels=['Ein Raum. Mein Werdegang.','Das bin ich.','Mein beruflicher Weg.','Lernen und weiterdenken.','Was ich beigetragen habe.','Was ich mitbringe.','Lassen Sie uns sprechen.'];
const excerpts=[
  'Scrollen Sie durch mein Arbeitszimmer und lernen Sie mich kennen.',
  'Systemoptimierung, Problemlösung und Wissenstransfer – ergänzt durch KI.',
  'Daten verstehen, technische Abläufe verbessern und Wissen weitergeben.',
  'Vom Logistikstudium zur Weiterbildung in KI-Agenten und Workflows.',
  'Praxisbeiträge, internationale Zusammenarbeit und kontinuierliche Weiterbildung.',
  'Technik, Daten, Automatisierung und internationale Zusammenarbeit.',
  'Eine gute Aufgabe beginnt mit einem Gespräch.'
];
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function goTo(index){
  index=Math.max(0,Math.min(6,index));
  if(flat){setFlat(false);}
  // Synchronize the scroll position immediately; the room animates the direct pan.
  scrollTo({top:index*innerHeight*1.1,behavior:'instant'});
  room?.goTo(index);
  setActive(index);
  if(steppedMode)mobileSteps.hold();
}
function syncNavigation(){
  const enabled=Boolean(room&&!flat&&mobile.matches),changed=enabled!==steppedMode;
  steppedMode=enabled;root.classList.toggle('mobile-room',enabled);
  if(changed){mobileSteps.reset();touchingRoom=false;}
  if(room&&!flat&&(changed||enabled))goTo(active);
  $('.scroll-hint').innerHTML='<span aria-hidden="true">↕</span> '+(enabled?'WISCHEN · EIN BEREICH PRO GESTE':'SCROLLEN · LEUCHTENDE OBJEKTE ANKLICKEN');
  root.dataset.mobileHold=String(enabled&&mobileSteps.isLocked());
}
function acceptsSwipe(event){
  return steppedMode&&!detail.open&&!privacy.open&&!event.target.closest?.('button,a,input,textarea,select,dialog');
}
addEventListener('touchstart',event=>{
  touchingRoom=acceptsSwipe(event)&&event.touches.length===1;
  if(touchingRoom)mobileSteps.touchStart(event.touches[0].clientX,event.touches[0].clientY);
  else mobileSteps.touchEnd();
},{passive:true});
addEventListener('touchmove',event=>{
  if(!touchingRoom||!steppedMode||detail.open||privacy.open)return;
  if(event.touches.length!==1){touchingRoom=false;mobileSteps.touchEnd();return;}
  if(event.cancelable)event.preventDefault();
  mobileSteps.touchMove(event.touches[0].clientX,event.touches[0].clientY);
},{passive:false});
for(const name of ['touchend','touchcancel'])addEventListener(name,()=>{touchingRoom=false;mobileSteps.touchEnd();},{passive:true});
addEventListener('wheel',event=>{
  if(!acceptsSwipe(event)||event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  if(event.cancelable)event.preventDefault();
  mobileSteps.wheel(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1));
},{passive:false});
mobile.addEventListener('change',syncNavigation);
addEventListener('resize',()=>{if(steppedMode)syncNavigation();});
function showDetails(index=active){
  if(index===0){goTo(1);return;}
  const targetIds={1:'text-profil',2:'text-weg',3:'text-weg',4:'text-projekte',5:'text-kompetenzen',6:'text-kontakt'};
  $('#detail-title').textContent=labels[index];$('#detail-index').textContent='BEREICH '+String(index).padStart(2,'0')+' / 06';
  const target=document.getElementById(targetIds[index]);
  if(index===2 || index===3){
    const selectors=index===2?data.timeline.filter(item=>!item.organization.includes('Syntax')&&!item.organization.includes('Ostfalia')):data.timeline.filter(item=>item.organization.includes('Syntax')||item.organization.includes('Ostfalia'));
    const names=new Set(selectors.map(item=>item.organization));
    const entries=[...target.querySelectorAll('.milestone')].filter(item=>names.has(item.querySelector('.organization').textContent));
    $('#detail-content').innerHTML=entries.map(item=>item.outerHTML).join('');
  }else $('#detail-content').innerHTML=target.innerHTML.replace(/<p class="eyebrow">[\s\S]*?<\/p>/,'').replace(/<h2[^>]*>[\s\S]*?<\/h2>/,'');
  detail.showModal();
}
function setActive(index){
  if(active===index && $('#chapter-title').textContent===labels[index])return;
  active=index;$('#chapter-number').textContent=String(index).padStart(2,'0')+' / 06';
  $('#chapter-title').textContent=labels[index];$('#chapter-caption').textContent=excerpts[index];
  $('.read-details').innerHTML=(index===0?'Raum erkunden':'Informationen lesen')+' <span aria-hidden="true">'+(index===0?'↓':'↗')+'</span>';
  $('.previous').disabled=index===0;$('.next').disabled=index===6;
  document.querySelectorAll('.stop-dots span').forEach((item,i)=>item.classList.toggle('active',i===index));
  document.querySelectorAll('[data-stop]').forEach(item=>{if(Number(item.dataset.stop)===index)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
  document.body.dataset.chapter=String(index);
}
function update(){
  if(!room)return;
  if(!flat){
    if(steppedMode){room.setProgress(active);root.dataset.mobileHold=String(mobileSteps.isLocked());}
    else{const progress=scrollY/(innerHeight*1.1);room.setProgress(progress);setActive(Math.round(Math.max(0,Math.min(6,progress))));}
  }
  requestAnimationFrame(update);
}
function setFlat(enabled){
  flat=enabled;room?.setPaused(enabled);document.body.classList.toggle('text-mode',enabled);textToggle.textContent=enabled?'Zurück in den Raum':'Textansicht';
  textToggle.setAttribute('aria-pressed',String(enabled));textToggle.title=enabled?'Zurück zum 3D-Arbeitszimmer':'Alle Informationen als Text lesen';
  syncNavigation();
  if(enabled)scrollTo({top:0,behavior:'instant'});else{scrollTo({top:active*innerHeight*1.1,behavior:'instant'});room?.resize();}
}
$('.read-details').addEventListener('click',()=>showDetails());
$('.previous').addEventListener('click',()=>goTo(active-1));$('.next').addEventListener('click',()=>goTo(active+1));
textToggle.addEventListener('click',()=>setFlat(!flat));
$('.skip-link').addEventListener('click',event=>{if(room){event.preventDefault();setFlat(true);$('.readable').setAttribute('tabindex','-1');$('.readable').focus();}});
$('.name-link').addEventListener('click',event=>{if(room){event.preventDefault();goTo(0);}});
for(const link of document.querySelectorAll('[data-stop]'))link.addEventListener('click',event=>{if(room){event.preventDefault();goTo(Number(link.dataset.stop));}else{event.preventDefault();const id=Number(link.dataset.stop)===3?'text-weg':{0:'textansicht',1:'text-profil',2:'text-weg',4:'text-projekte',5:'text-kompetenzen',6:'text-kontakt'}[link.dataset.stop];document.getElementById(id)?.scrollIntoView();}});
$('.privacy-button').addEventListener('click',event=>{if(typeof privacy.showModal==='function'){event.preventDefault();privacy.showModal();}});
for(const dialog of [detail,privacy])dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
addEventListener('keydown',event=>{
  if(!room || flat || detail.open || privacy.open || ['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
  if(steppedMode&&['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(event.key)){
    event.preventDefault();if(!event.repeat)mobileSteps.step(['ArrowUp','PageUp'].includes(event.key)||event.shiftKey?-1:1);return;
  }
  if(event.key==='ArrowRight'){event.preventDefault();goTo(active+1);}
  if(event.key==='ArrowLeft'){event.preventDefault();goTo(active-1);}
  if(event.key==='Home'){event.preventDefault();goTo(0);}
  if(event.key==='End'){event.preventDefault();goTo(6);}
  if(/^[1-6]$/.test(event.key)){event.preventDefault();goTo(Number(event.key));}
});
$('.light-toggle').addEventListener('click',()=>{
  bright=!bright;room?.setLight(bright);$('.light-toggle').textContent=bright?'Licht: hell':'Licht: Abend';$('.light-toggle').setAttribute('aria-pressed',String(bright));
  try{localStorage.setItem('tamerlan-room-light',bright?'light':'dark');}catch{}
});
// Rain behind glass: a quiet stereo bed, many soft impacts and occasional larger drops.
// Generated once on demand; no microphone, network request or audio dependency.
function createRainBuffer(context){
  const rate=context.sampleRate,duration=24,length=Math.round(rate*duration);
  const buffer=context.createBuffer(2,length,rate),channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
  let seed=581329;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  for(let channel=0;channel<2;channel++){
    const samples=channels[channel];let low=0;
    for(let i=0;i<length;i++){
      const white=random()*2-1;low+=.075*(white-low);
      const swell=.86+.10*Math.sin(i/length*Math.PI*4)+.04*Math.sin(i/length*Math.PI*10);
      samples[i]=(low*.028+white*.003)*swell;
    }
  }
  for(let event=0;event<duration*70;event++){
    const start=Math.floor(random()*length),large=random()<.065;
    const life=large?.05+random()*.075:.009+random()*.030;
    const frequency=large?450+random()*1100:1400+random()*3100;
    const strength=large?.05+random()*.065:.012+random()*.030;
    const pan=random(),left=Math.sqrt(1-pan),right=Math.sqrt(pan);
    let softened=0;
    for(let j=0;j<Math.ceil(life*rate);j++){
      const t=j/rate,attack=Math.min(1,t/.0007),decay=Math.exp(-t/life*7);
      softened+=.42*((random()*2-1)-softened);
      const tap=Math.sin(2*Math.PI*frequency*t*(1-.22*t/life));
      const tail=Math.sin(2*Math.PI*frequency*.53*t)*Math.exp(-t/life*4);
      const sample=strength*attack*decay*(softened*.70+tap*.24+tail*.13);
      const index=(start+j)%length;channels[0][index]+=sample*left;channels[1][index]+=sample*right;
    }
  }
  // Remove a seam in the low background without losing any of the wrapped impacts.
  for(const samples of channels){const offset=samples[length-1]-samples[0];const fade=Math.round(rate*.04);for(let i=0;i<fade;i++)samples[i]+=offset*(1-i/fade);}
  return buffer;
}
let audioContext=null,audioSource=null,audioGain=null;
$('.sound-toggle').addEventListener('click',async()=>{
  const button=$('.sound-toggle');
  if(button.getAttribute('aria-pressed')==='true'){audioGain.gain.setTargetAtTime(0,audioContext.currentTime,.12);button.setAttribute('aria-pressed','false');button.textContent='Ton: aus';return;}
  try{
    if(!audioContext){
      const AudioContext=window.AudioContext||window.webkitAudioContext;audioContext=new AudioContext();
      audioSource=audioContext.createBufferSource();audioSource.buffer=createRainBuffer(audioContext);audioSource.loop=true;
      audioGain=audioContext.createGain();audioGain.gain.value=0;
      audioSource.connect(audioGain);audioGain.connect(audioContext.destination);audioSource.start();
    }
    await audioContext.resume();audioGain.gain.setTargetAtTime(.78,audioContext.currentTime,.35);button.setAttribute('aria-pressed','true');button.textContent='Ton: Regen';
  }catch{button.textContent='Ton nicht verfügbar';button.disabled=true;}
});
const grain=document.createElement('canvas');grain.width=grain.height=128;const g=grain.getContext('2d');const pixels=g.createImageData(128,128);for(let i=0;i<pixels.data.length;i+=4){const value=Math.random()*255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}g.putImageData(pixels,0,0);$('.film-grain').style.backgroundImage=`url(${grain.toDataURL()})`;
async function init(){
  if(reduce.matches){document.body.dataset.motion='reduced';}
  loader.hidden=false;
  try{
    const response=await fetch('./data.json');if(!response.ok)throw new Error('Profildaten konnten nicht geladen werden.');data=await response.json();
    sceneElement.hidden=false;
    room=createRoom(sceneElement,data,index=>{if(active===index)showDetails(index);else goTo(index);});
    document.body.classList.add('room-ready');journey.hidden=false;hud.hidden=false;textToggle.hidden=false;
    for(const selector of ['.scroll-hint','.light-toggle','.sound-toggle'])$(selector).hidden=false;
    try{bright=localStorage.getItem('tamerlan-room-light')==='light';}catch{}
    room.setLight(bright);$('.light-toggle').textContent=bright?'Licht: hell':'Licht: Abend';$('.light-toggle').setAttribute('aria-pressed',String(bright));
    $('.previous').disabled=true;setActive(0);syncNavigation();update();
    if(reduce.matches)setFlat(true);
  }catch(error){sceneElement.hidden=true;document.body.dataset.roomError='WebGL nicht verfügbar; vollständige Textansicht aktiv.';console.warn('3D-Ansicht nicht verfügbar; Textansicht bleibt lesbar.',error);}
  finally{loader.hidden=true;}
}
reduce.addEventListener('change',event=>{if(event.matches && room)setFlat(true);});
init();
