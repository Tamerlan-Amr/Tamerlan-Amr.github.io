// Local day/night photography and quiet, synthesized birds; no remote services.
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
    loader.load(new URL('./'+file,import.meta.url).href,image=>{
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

// Phrases, pauses and different distances avoid a continuous electronic whistle.
// Rendering once keeps the optional sound light on CPU while exploring the room.
export function createBirdsongBuffer(context) {
  const rate=context.sampleRate,duration=48,length=Math.round(rate*duration);
  const buffer=context.createBuffer(2,length,rate);
  const channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
  let seed=142897;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  function note(start,life,base,sweep,strength,pan,trill){
    let phase=0,softNoise=0;
    const left=Math.sqrt(1-pan),right=Math.sqrt(pan),begin=Math.round(start*rate);
    for(let i=0;i<Math.ceil(life*rate);i++){
      const index=begin+i;if(index>=length-Math.round(rate*.5))break;
      const t=i/rate,u=t/life;
      const envelope=Math.pow(Math.max(0,Math.sin(Math.PI*u)),1.65);
      const pitch=base+sweep*(u-.5)+Math.sin(t*Math.PI*2*trill)*(55+130*u);
      phase+=Math.PI*2*pitch/rate;
      softNoise+=.28*((random()*2-1)-softNoise);
      const breath=Math.sin(phase)*.86+Math.sin(phase*2+.16)*.08+softNoise*.035;
      const sample=strength*envelope*breath;
      channels[0][index]+=sample*left;channels[1][index]+=sample*right;
      const echo=index+Math.round(rate*.034);
      if(echo<length){channels[0][echo]+=sample*right*.11;channels[1][echo]+=sample*left*.11;}
    }
  }
  for(let start=1;start<duration-2;start+=2.3+random()*2.4){
    const pan=.15+random()*.7,strength=.10+random()*.055;
    let position=start;const count=3+Math.floor(random()*4);
    for(let i=0;i<count;i++){
      const life=.12+random()*.19;
      note(position,life,1550+random()*1400,(random()-.4)*1600,strength,pan,5+random()*13);
      position+=life+.06+random()*.12;
    }
  }
  for(let start=2;start<duration-1;start+=3.6+random()*3.7){
    const pan=random(),count=2+Math.floor(random()*4);
    for(let i=0;i<count;i++){
      note(start+i*.15,.07+random()*.07,2800+random()*1200,700+random()*1100,.045+random()*.025,pan,20+random()*16);
    }
  }
  return buffer;
}

export function bindBirdsong(button) {
  let context=null,source=null,gain=null,enabled=false,busy=false,revision=0;
  const update=()=>{
    button.textContent=enabled?'Vögel: an':'Vögel: aus';
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',enabled?'Vogelgezwitscher ausschalten':'Vogelgezwitscher einschalten');
  };
  update();
  button.addEventListener('click',async()=>{
    if(busy)return;
    const current=++revision;
    if(enabled){
      enabled=false;gain.gain.setTargetAtTime(0,context.currentTime,.04);update();
      setTimeout(()=>{if(revision===current&&!enabled)void context.suspend();},250);
      return;
    }
    busy=true;
    try{
      if(!context){
        const Audio=window.AudioContext||window.webkitAudioContext;
        context=new Audio();
        // Resume in the user gesture before the one-time buffer rendering.
        await context.resume();
        source=context.createBufferSource();source.buffer=createBirdsongBuffer(context);source.loop=true;
        gain=context.createGain();gain.gain.value=0;
        source.connect(gain);gain.connect(context.destination);source.start();
      }else await context.resume();
      enabled=true;gain.gain.setTargetAtTime(.42,context.currentTime,.2);update();
    }catch{
      enabled=false;button.textContent='Vögel nicht verfügbar';button.disabled=true;
    }finally{busy=false;}
  });
  document.addEventListener('visibilitychange',()=>{
    if(!context||!enabled)return;
    if(document.hidden)void context.suspend();else void context.resume();
  });
  window.addEventListener('pagehide',()=>{if(context)void context.suspend();});
  window.addEventListener('pageshow',()=>{if(context&&enabled&&!document.hidden)void context.resume();});
}
