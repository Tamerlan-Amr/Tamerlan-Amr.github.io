// Matched day/night photography and a real field recording from this website.
import {createMobileSteps} from './mobile-steuerung.js';

export function createSalzgitterSteps({isMobile=()=>false,now=()=>performance.now(),...options}){
  const steps=createMobileSteps({...options,now});
  let distance=0,lastWheel=-Infinity;
  return {...steps,wheel(delta){
    if(isMobile())return steps.wheel(delta);
    const time=now();
    if(time-lastWheel>180)distance=0;
    lastWheel=time;
    // Drop input during motion/rest, but do not wait indefinitely for a
    // trackpad's quiet gap. A new intentional scroll can resume after arrival.
    if(steps.isLocked()){distance=0;return false;}
    distance+=delta;
    if(Math.abs(distance)<(options.threshold??48))return false;
    const direction=Math.sign(distance);distance=0;return steps.step(direction);
  },reset(){distance=0;lastWheel=-Infinity;steps.reset();}};
}
export function createWindowView(THREE, renderer, panel) {
  const placeholder=panel.material.map;
  const images={};let day=true;
  const apply=()=>{
    const mode=day?'day':'night';
    panel.material.map=images[mode]??placeholder;
    panel.material.needsUpdate=true;
    renderer.domElement.dataset.exterior=mode;
    renderer.domElement.dataset.exteriorStatus=images[mode]?'ready':'loading';
  };
  const loader=new THREE.TextureLoader();
  for(const [mode,file] of [['day','salzgitter-tag.jpg'],['night','salzgitter-nacht.jpg']]){
    loader.load(new URL('./'+file+'?v=20261021-2',import.meta.url).href,image=>{
      image.colorSpace=THREE.SRGBColorSpace;
      image.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      // Identical crop for both photographs: the stele moves left of the CRT.
      image.repeat.set(.87,.87);image.offset.set(.13,.065);
      images[mode]=image;apply();
    },undefined,()=>{
      if((day?'day':'night')===mode)renderer.domElement.dataset.exteriorStatus='unavailable';
    });
  }
  return {
    setDay(value){day=Boolean(value);apply();},
    dispose(){placeholder.dispose();for(const image of Object.values(images))image.dispose();}
  };
}

// The selected artwork uses the existing poster's size and wall position.
export function createPosterView(THREE, renderer, panel) {
  const placeholder=panel.material.map;
  let image=null,disposed=false;
  renderer.domElement.dataset.posterStatus='loading';
  new THREE.TextureLoader().load(new URL('./salcos-poster.jpg',import.meta.url).href,value=>{
    if(disposed){value.dispose();return;}
    image=value;image.colorSpace=THREE.SRGBColorSpace;
    image.anisotropy=renderer.capabilities.getMaxAnisotropy();
    panel.material.map=image;panel.material.needsUpdate=true;
    renderer.domElement.dataset.posterStatus='ready';
  },undefined,()=>{if(!disposed)renderer.domElement.dataset.posterStatus='unavailable';});
  return {dispose(){disposed=true;placeholder.dispose();image?.dispose();}};
}

// Use only the artwork inside the selected frame preview. UV coordinates keep
// its photographed border/table out of the real three-dimensional room frame.
export function createFramedView(THREE, renderer, panel) {
  const placeholder=panel.material.map;
  let image=null,disposed=false;
  const uv=panel.geometry.attributes.uv;
  const corners={tl:[159/1448,1-173/1086],tr:[1276/1448,1-158/1086],bl:[132/1448,1-822/1086],br:[1254/1448,1-879/1086]};
  for(let i=0;i<uv.count;i++){
    const u=uv.getX(i),v=uv.getY(i);
    const bottom=corners.bl.map((n,j)=>n+(corners.br[j]-n)*u);
    const top=corners.tl.map((n,j)=>n+(corners.tr[j]-n)*u);
    uv.setXY(i,bottom[0]+(top[0]-bottom[0])*v,bottom[1]+(top[1]-bottom[1])*v);
  }
  uv.needsUpdate=true;renderer.domElement.dataset.frameStatus='loading';
  new THREE.TextureLoader().load(new URL('./salzgitter-luftbild-rahmen.jpg',import.meta.url).href,value=>{
    if(disposed){value.dispose();return;}
    image=value;image.colorSpace=THREE.SRGBColorSpace;
    image.anisotropy=renderer.capabilities.getMaxAnisotropy();
    panel.material.map=image;panel.material.needsUpdate=true;
    renderer.domElement.dataset.frameStatus='ready';
  },undefined,()=>{if(!disposed)renderer.domElement.dataset.frameStatus='unavailable';});
  return {dispose(){disposed=true;placeholder.dispose();image?.dispose();}};
}

export function bindAmbientSound(button) {
  let audio=null,wanted=false,playing=false,revision=0;
  const update=()=>{
    button.textContent=playing?'Sound: an':'Sound: aus';
    button.setAttribute('aria-pressed',String(playing));
    button.setAttribute('aria-label',wanted?'Naturklang ausschalten':'Naturklang einschalten');
    button.removeAttribute('aria-busy');
  };
  const play=async()=>{
    const current=++revision;
    button.textContent='Sound lädt…';button.setAttribute('aria-busy','true');
    try{
      await audio.play();
      if(current!==revision){if(!wanted)audio.pause();return;}
      playing=true;update();
    }catch{
      if(current!==revision)return;
      wanted=playing=false;update();
      button.textContent='Sound: erneut versuchen';
    }
  };
  update();
  button.addEventListener('click',()=>{
    wanted=!wanted;
    if(!wanted){++revision;audio?.pause();playing=false;update();return;}
    // No audio element, file request or playback before this explicit click.
    if(!audio){
      audio=document.createElement('audio');audio.hidden=true;
      audio.dataset.ambient='nature';audio.preload='none';audio.loop=true;audio.volume=.32;
      audio.src=new URL('./natur-vogelgesang.mp3',import.meta.url).href;
      document.body.appendChild(audio);
    }
    button.setAttribute('aria-label','Naturklang ausschalten');
    void play();
  });
  const pause=()=>{++revision;if(audio)audio.pause();playing=false;update();};
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)pause();else if(audio&&wanted)void play();
  });
  window.addEventListener('pagehide',pause);
  window.addEventListener('pageshow',()=>{if(audio&&wanted&&!document.hidden&&audio.paused)void play();});
}
