import {bindAmbientSound} from './umgebung.js?v=20261021-2';
import {createRoom} from './raum.js?v=20261021-2';
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
let room=null,active=0,flat=false,bright=true,data;
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
function updateDaylight(){
  room?.setLight(bright);
  const button=$('.light-toggle');
  button.textContent=bright?'Tag / Nacht: Tag':'Tag / Nacht: Nacht';
  button.title=bright?'Zur Nachtansicht wechseln':'Zur Tagansicht wechseln';
  button.setAttribute('aria-label',bright?'Tagansicht aktiv. Zur Nacht wechseln':'Nachtansicht aktiv. Zum Tag wechseln');
  button.setAttribute('aria-pressed',String(bright));
}
$('.light-toggle').addEventListener('click',()=>{
  bright=!bright;updateDaylight();
  try{localStorage.setItem('tamerlan-szag-daylight',bright?'day':'night');}catch{}
});
bindAmbientSound($('.sound-toggle'));
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
    try{bright=localStorage.getItem('tamerlan-szag-daylight')!=='night';}catch{}
    updateDaylight();
    $('.previous').disabled=true;setActive(0);syncNavigation();update();
    if(reduce.matches)setFlat(true);
  }catch(error){sceneElement.hidden=true;document.body.dataset.roomError='WebGL nicht verfügbar; vollständige Textansicht aktiv.';console.warn('3D-Ansicht nicht verfügbar; Textansicht bleibt lesbar.',error);}
  finally{loader.hidden=true;}
}
reduce.addEventListener('change',event=>{if(event.matches && room)setFlat(true);});
init();
