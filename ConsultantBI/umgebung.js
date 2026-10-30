import {createMobileSteps} from './mobile-steuerung.js';

export function createControlSteps({isMobile=()=>false,now=()=>performance.now(),...options}){
  const steps=createMobileSteps({...options,now});
  let distance=0,lastWheel=-Infinity;
  return {...steps,wheel(delta){
    if(isMobile())return steps.wheel(delta);
    const time=now();if(time-lastWheel>180)distance=0;lastWheel=time;
    if(steps.isLocked()){distance=0;return false;}
    distance+=delta;if(Math.abs(distance)<(options.threshold??48))return false;
    const direction=Math.sign(distance);distance=0;return steps.step(direction);
  },reset(){distance=0;lastWheel=-Infinity;steps.reset();}};
}

export function createWindowView(THREE,renderer,panel){
  const placeholder=panel.material.map,images={};let day=true,disposed=false;
  const apply=()=>{
    const mode=day?'day':'night';panel.material.map=images[mode]??placeholder;panel.material.needsUpdate=true;
    renderer.domElement.dataset.exterior=mode;renderer.domElement.dataset.exteriorStatus=images[mode]?'ready':'loading';
  };
  for(const [mode,file] of [['day','fi-hannover-tag.jpg'],['night','fi-hannover-nacht.png']]){
    new THREE.TextureLoader().load(new URL('../MajorIM/'+file,import.meta.url).href,map=>{
      if(disposed){map.dispose();return;}
      map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      // One common crop and UV transform; no camera or geometry changes at night.
      map.repeat.set(1,.825);map.offset.set(0,.085);images[mode]=map;apply();
    },undefined,()=>{if(!disposed)renderer.domElement.dataset.exteriorStatus='unavailable';});
  }
  return {setDay(value){day=Boolean(value);apply();},dispose(){disposed=true;placeholder.dispose();Object.values(images).forEach(map=>map.dispose());}};
}

function canvasMap(THREE,renderer,width,height,draw){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=renderer.capabilities.getMaxAnisotropy();return map;
}
export function createPosterView(THREE,renderer,panel){
  const placeholder=panel.material.map;let disposed=false;
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1500;
  const ctx=canvas.getContext('2d');
  const lettering=()=>{
    ctx.fillStyle='#203139';ctx.font='bold 108px Arial';
    ctx.fillText('LÖSUNGEN',82,1190);ctx.fillText('IM BLICK.',82,1310);
    ctx.fillStyle='#8a2529';ctx.font='31px Arial';ctx.fillText('Verstehen. Prüfen. Verständlich erklären.',85,1370);
    ctx.fillStyle='#59615d';ctx.font='21px Courier New';
    ctx.fillText('TAMERLAN AMIRCHANOV / CONSULTANT KUNDENSERVICE',85,1450);
  };
  ctx.fillStyle='#f5eee3';ctx.fillRect(0,0,1200,1500);lettering();
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=renderer.capabilities.getMaxAnisotropy();
  panel.material.map=map;panel.material.needsUpdate=true;renderer.domElement.dataset.posterStatus='loading';
  const art=new Image();
  art.onload=()=>{if(disposed)return;ctx.drawImage(art,0,0,1200,1500);lettering();map.needsUpdate=true;renderer.domElement.dataset.posterStatus='ready';};
  art.onerror=()=>{if(!disposed)renderer.domElement.dataset.posterStatus='unavailable';};
  art.src=new URL('../MajorIM/poster-sparkasse.png',import.meta.url).href;
  return {dispose(){disposed=true;art.onload=art.onerror=null;placeholder.dispose();map.dispose();}};
}
export function createFramedView(THREE,renderer,panel){
  const placeholder=panel.material.map;
  const map=canvasMap(THREE,renderer,1548,900,(ctx,w,h)=>{
    ctx.fillStyle='#182a32';ctx.fillRect(0,0,w,h);ctx.fillStyle='#eae8d9';ctx.font='bold 64px Courier New';ctx.fillText('MEIN WEG ZUR LÖSUNG',90,126);
    const labels=['ANWENDERFRAGE VERSTEHEN','DATEN UND URSACHEN PRÜFEN','LÖSUNG VERSTÄNDLICH ERKLÄREN','WISSEN WEITERGEBEN'];
    labels.forEach((label,i)=>{
      const y=275+i*145;ctx.fillStyle='#e9ba75';ctx.font='bold 55px Courier New';ctx.fillText(String(i+1).padStart(2,'0'),92,y);
      ctx.fillStyle='#eae8d9';ctx.font='bold 49px Arial';ctx.fillText(label,215,y);
      if(i<3){ctx.strokeStyle='#eae8d92b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(92,y+44);ctx.lineTo(w-90,y+44);ctx.stroke();}
    });
    ctx.fillStyle='#abc0b5';ctx.font='27px Courier New';ctx.fillText('AUS MEINER TECHNISCHEN SUPPORTPRAXIS',92,h-58);
  });
  panel.material.map=map;panel.material.needsUpdate=true;renderer.domElement.dataset.frameStatus='ready';
  return {dispose(){placeholder.dispose();map.dispose();}};
}
