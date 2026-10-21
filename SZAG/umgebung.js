// Matched day/night photography and a real field recording from this website.
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
