import {createWindowView,createPosterView,createFramedView} from './umgebung.js?v=20261022-2';
import * as THREE from '../vendor/three.module.js';

// Geometry and materials are created locally. No remote models or textures.
export function createRoom(container, data, onSelect) {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#191e24');
  scene.fog=new THREE.FogExp2('#1b2025',.013);
  const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.04,80);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const materials=[];const animated=[];const interactive=[];
  let randomSeed=38171;
  const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)|0;return (randomSeed>>>0)/4294967296;};
  const material=(color,options={})=>{const value=new THREE.MeshStandardMaterial({color,roughness:.72,...options});materials.push(value);return value;};
  const texture=(width,height,draw,density=1)=>{
    const scale=Math.min(density,renderer.capabilities.maxTextureSize/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    const ctx=canvas.getContext('2d');ctx.scale(canvas.width/width,canvas.height/height);draw(ctx,width,height);
    const value=new THREE.CanvasTexture(canvas);value.colorSpace=THREE.SRGBColorSpace;value.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return value;
  };
  // Oversample lettering, with a pixel budget for the larger paper surfaces.
  const textTexture=(width,height,draw)=>{
    const map=texture(width,height,draw,Math.min(2,Math.sqrt(4000000/(width*height))));
    map.anisotropy=renderer.capabilities.getMaxAnisotropy();return map;
  };
  const wrap=(ctx,text,x,y,maxWidth,lineHeight)=>{
    let line='';
    for(const paragraph of String(text).split('\n')){
      for(const word of paragraph.split(' ')){
        if(ctx.measureText(line+word+' ').width>maxWidth && line){ctx.fillText(line.trim(),x,y);y+=lineHeight;line='';}
        line+=word+' ';
      }
      if(line){ctx.fillText(line.trim(),x,y);y+=lineHeight;line='';}
    }
    return y;
  };
  const bulletList=(ctx,items,x,y,maxWidth,lineHeight,gap=8)=>{
    for(const text of items??[]){
      ctx.beginPath();ctx.arc(x+5,y-lineHeight*.25,4,0,Math.PI*2);ctx.fill();
      y=wrap(ctx,text,x+27,y,maxWidth-27,lineHeight)+gap;
    }
    return y;
  };
  function roundedGeometry(w,h,d,r=.06){
    r=Math.min(r,w/5,h/5,d/3);
    const x=-w/2+r,y=-h/2+r,shape=new THREE.Shape();
    shape.moveTo(x+r,y);shape.lineTo(x+w-3*r,y);shape.quadraticCurveTo(x+w-2*r,y,x+w-2*r,y+r);
    shape.lineTo(x+w-2*r,y+h-3*r);shape.quadraticCurveTo(x+w-2*r,y+h-2*r,x+w-3*r,y+h-2*r);
    shape.lineTo(x+r,y+h-2*r);shape.quadraticCurveTo(x,y+h-2*r,x,y+h-3*r);
    shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.005,d-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:4,steps:1});
    geometry.translate(0,0,-d/2+r);return geometry;
  }
  function box(parent,w,h,d,at,mat,r=0){
    const mesh=new THREE.Mesh(r?roundedGeometry(w,h,d,r):new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(...at);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function cylinder(parent,top,bottom,height,at,mat,segments=24){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,segments),mat);mesh.position.set(...at);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function label(parent,width,height,at,map,rotation=[0,0,0],emissive=true){
    const mat=emissive?new THREE.MeshBasicMaterial({map,toneMapped:false,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({map,roughness:.9,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);mesh.position.set(...at);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;
  }
  function information(parent,width,height,at,map,rotation){
    const mesh=label(parent,width,height,at,map,rotation,true);
    mesh.material.fog=false;return mesh;
  }
  function pick(group,index,surface){
    group.userData.stop=index;
    // A warm rim and a slow light sweep mark the actual information surface.
    // Depth testing keeps this cue behind objects that physically cover it.
    const glow=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      uniforms:{time:{value:0},focus:{value:0},phase:{value:index*.47}},
      vertexShader:'varying vec2 uvSurface; void main(){uvSurface=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`varying vec2 uvSurface; uniform float time; uniform float focus; uniform float phase;
        void main(){
          float edge=min(min(uvSurface.x,1.0-uvSurface.x),min(uvSurface.y,1.0-uvSurface.y));
          float rim=1.0-smoothstep(0.0,0.018,edge);
          float sweep=fract(uvSurface.x*0.72+uvSurface.y*0.28-time*0.12+phase);
          float sheen=pow(max(0.0,1.0-abs(sweep-0.5)/0.085),2.0);
          float breathe=0.84+0.16*sin(time*1.25+phase);
          float alpha=rim*(0.22*breathe+focus*0.36+sheen*0.18);
          gl_FragColor=vec4(1.0,0.83,0.54,alpha);
        }`
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(surface.width,surface.height),glow);
    mesh.position.set(...surface.at);mesh.rotation.set(...(surface.rotation??[0,0,0]));
    mesh.userData.glimmer=true;group.add(mesh);
    interactive.push({group,glow});
  }
  const woodTexture=texture(1024,512,(ctx,w,h)=>{
    ctx.fillStyle='#765139';ctx.fillRect(0,0,w,h);
    for(let y=0;y<h;y++){
      const tone=88+Math.sin(y*.032)*10+random()*14;
      ctx.strokeStyle=`rgba(${tone+35},${tone},${tone-20},.28)`;ctx.beginPath();
      for(let x=0;x<=w;x+=16){const yy=y+Math.sin(x*.012+y*.002)*3+Math.sin(x*.038+y*.004);x?ctx.lineTo(x,yy):ctx.moveTo(x,yy);}ctx.stroke();
    }
    for(let i=0;i<14;i++){const x=random()*w,y=random()*h;ctx.strokeStyle='#412b2525';ctx.lineWidth=1;for(let j=1;j<9;j++){ctx.beginPath();ctx.ellipse(x,y,5*j,1.2*j,0,0,Math.PI*2);ctx.stroke();}}
  });
  const wood=material('#d1ae85',{map:woodTexture,roughness:.48,bumpMap:woodTexture,bumpScale:.016});
  const darkWood=material('#69503d',{map:woodTexture,roughness:.64});
  const plasterTexture=texture(256,256,(ctx,w,h)=>{ctx.fillStyle='#bca783';ctx.fillRect(0,0,w,h);for(let i=0;i<16000;i++){ctx.fillStyle=random()>.5?'#ffffff07':'#00000009';ctx.fillRect(random()*w,random()*h,1,1);}});
  plasterTexture.wrapS=plasterTexture.wrapT=THREE.RepeatWrapping;plasterTexture.repeat.set(4,2);
  const plaster=material('#b2a58e',{map:plasterTexture,roughness:1});
  const bronze=material('#8e6740',{metalness:.58,roughness:.3});
  const beige=material('#c9c2a4',{roughness:.7});const black=material('#232726',{roughness:.56});
  const green=material('#233c2a',{roughness:.61});const cream=material('#ede7d0');
  const room=new THREE.Group();scene.add(room);
  box(room,12,.16,12,[0,-.10,0],darkWood);
  // Individual floor boards preserve perspective and natural seams.
  for(let i=0;i<16;i++){const plank=box(room,.735,.025,11.9,[-5.65+i*.75,.0,0],wood);plank.material=wood.clone();plank.material.color.setHSL(.065,.23,.44+random()*.06);}
  box(room,12,5.8,.16,[0,2.85,-4.65],plaster);
  box(room,.14,5.8,11.8,[-5.8,2.85,1.15],plaster);
  box(room,.14,5.8,11.8,[5.8,2.85,1.15],plaster);
  box(room,12,.16,12,[0,5.7,0],plaster);
  const trim=material('#5a4937');box(room,11.6,.16,.09,[0,.11,-4.5],trim);box(room,.1,.16,11.6,[-5.69,.11,1.2],trim);box(room,.1,.16,11.6,[5.69,.11,1.2],trim);

  const city=texture(16,16,(ctx,w,h)=>{ctx.fillStyle='#566b80';ctx.fillRect(0,0,w,h);});
  const cityPanel=label(room,6.5,3.6,[-.65,3.1,-4.45],city);
  const windowView=createWindowView(THREE,renderer,cityPanel);
  const windowMat=material('#665642',{roughness:.6});
  for(const x of [-3.94,-.65,2.64])box(room,.10,3.8,.22,[x,3.1,-4.25],windowMat);
  for(const y of [1.24,3.24,4.95])box(room,6.72,.12,.26,[-.65,y,-4.25],windowMat);
  box(room,6.95,.13,.56,[-.65,1.20,-4.1],wood);
  // Curtain folds are real geometry, rather than a flat photo background.
  const curtainMat=material('#9e9177',{roughness:1,side:THREE.DoubleSide});
  for(const x of [-4.14,2.86]){
    const geometry=new THREE.PlaneGeometry(1.05,4.25,32,12);const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const xx=positions.getX(i),yy=positions.getY(i);positions.setZ(i,Math.sin(xx*27)*.11+.015*Math.cos(yy*2));}
    geometry.computeVertexNormals();const curtain=new THREE.Mesh(geometry,curtainMat);curtain.position.set(x,2.78,-4.02);curtain.castShadow=true;room.add(curtain);
  }
  box(room,8.3,.055,.055,[-.65,4.98,-3.91],bronze);
  renderer.domElement.dataset.weather='clear';

  // Walnut desk, drawers and detailed retro equipment.
  const desk=new THREE.Group();room.add(desk);
  box(desk,7.5,.14,3.65,[-.10,1.25,-1.475],wood,.025);
  for(const x of [-3.50,3.30])for(const z of [-2.96,.02])box(desk,.12,1.18,.12,[x,.60,z],darkWood);
  box(desk,1.1,.65,2.8,[-2.85,.84,-1.20],darkWood,.04);
  for(let i=0;i<3;i++){box(desk,.99,.18,.04,[-2.85,.64+i*.19,.225],wood,.012);box(desk,.27,.018,.06,[-2.85,.64+i*.19,.26],bronze,.005);}
  box(desk,1.1,.6,2.8,[2.75,.84,-1.20],darkWood,.03);
  const screenTexture=(theme,draw)=>textTexture(1024,768,(ctx,w,h)=>{
    const gradient=ctx.createLinearGradient(0,0,w,h);gradient.addColorStop(0,theme==='green'?'#102c24':'#172b48');gradient.addColorStop(1,theme==='green'?'#071d16':'#0c192d');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=theme==='green'?'#e4f9e9':'#f0f5ff';draw(ctx,w,h);
  });
  const introTexture=screenTexture('blue',(ctx,w,h)=>{
    ctx.font='bold 23px Courier New';ctx.fillText('PROFIL   /   ONLINE-LEBENSLAUF',65,55);ctx.fillText('CH 01',w-165,55);
    ctx.font='bold 62px Courier New';const names=data.name.split(' ');ctx.fillText(names[0].toUpperCase(),65,133);ctx.fillText(names.slice(1).join(' ').toUpperCase(),65,206);
    ctx.fillRect(65,238,w-130,2);const monitorEyebrow=data.content.monitor_eyebrow??data.content.eyebrow;
    let eyebrowSize=26;
    do{ctx.font='bold '+eyebrowSize+'px Courier New';if(ctx.measureText(monitorEyebrow).width<=w-130)break;}while(--eyebrowSize>18);
    wrap(ctx,monitorEyebrow,65,283,w-130,30);
    const introMeasure=document.createElement('canvas').getContext('2d');
    let introSize=46;
    for(;introSize>28;introSize--){
      introMeasure.font='500 '+introSize+'px Arial';
      if(wrap(introMeasure,data.content.intro,65,352,w-130,introSize*1.2)<=h-85)break;
    }
    ctx.font='500 '+introSize+'px Arial';wrap(ctx,data.content.intro,65,352,w-130,introSize*1.2);
    ctx.font='bold 22px Courier New';ctx.fillStyle='#d3e3ef';wrap(ctx,data.content.availability.toUpperCase(),65,h-34,w-130,26);
  });
  function monitor(at,scale,screenMap,caseMaterial,stop){
    const group=new THREE.Group();group.position.set(...at);group.scale.setScalar(scale);desk.add(group);
    box(group,1.84,1.63,1.4,[0,.95,0],caseMaterial,.08);
    box(group,1.58,1.24,.10,[0,1.04,.716],black,.025);
    const geo=new THREE.PlaneGeometry(1.39,1.04,32,24);const vertices=geo.attributes.position;
    for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i);vertices.setZ(i,.035*(1-Math.pow(x/.78,2)-Math.pow(y/.66,2)));}geo.computeVertexNormals();
    const screen=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:screenMap,toneMapped:false}));screen.position.set(0,1.05,.79);group.add(screen);
    box(group,1.64,.16,1.23,[0,.11,.03],caseMaterial,.02);
    const brand=texture(512,64,ctx=>{ctx.fillStyle='#bfc1b1';ctx.font='bold 28px Courier New';ctx.fillText(data.name.split(' ').slice(1).join(' ').toUpperCase(),10,42);ctx.font='18px Courier New';ctx.fillText('STUDIO / 01',337,42);});
    label(group,1.5,.08,[0,1.65,.745],brand);
    for(let i=0;i<6;i++){box(group,.095,.045,.03,[-.62+i*.15,.28,.764],beige,.005);}
    for(let i=0;i<2;i++){const dial=cylinder(group,.045,.045,.04,[.52+i*.16,.28,.78],bronze,16);dial.rotation.x=Math.PI/2;}
    const led=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),new THREE.MeshBasicMaterial({color:'#b7ff97'}));led.position.set(-.71,.37,.787);group.add(led);
    for(let i=0;i<8;i++)box(group,.22,.015,.015,[.813,.65+i*.09,.55],black);
    pick(group,stop,{width:1.39,height:1.04,at:[0,1.05,.83]});return group;
  }
  const crtCase=material('#3b3932',{roughness:.62});
  // The CRT rests on the recorder. The keyboard has its own clear area in front.
  monitor([-1.30,1.61,-2.45],1,introTexture,crtCase,1);
  const vcr=new THREE.Group();vcr.position.set(-1.30,1.48,-2.45);desk.add(vcr);
  box(vcr,2.02,.32,1.4,[0,0,0],black,.025);box(vcr,1.04,.065,.012,[-.28,.02,.707],material('#111b17'));
  const clock=texture(384,96,ctx=>{ctx.fillStyle='#081b19';ctx.fillRect(0,0,384,96);ctx.fillStyle='#addacf';ctx.font='bold 34px Courier New';ctx.fillText(data.updated.slice(0,4)+'  /  READY',17,61);});label(vcr,.63,.15,[.58,.03,.715],clock);
  for(let i=0;i<4;i++)box(vcr,.055,.02,.018,[.4+i*.12,-.095,.716],bronze);
  const projectTexture=screenTexture('green',(ctx,w,h)=>{
    ctx.font='bold 24px Courier New';ctx.fillText('ERFOLGE  /  AUS DER PRAXIS',55,59);ctx.fillText('CH 04',w-175,59);
    data.achievements.forEach((item,index)=>{
      const top=143+index*145;
      ctx.fillStyle='#e4f9e9';ctx.font='bold 40px Arial';const y=wrap(ctx,String(index+1).padStart(2,'0')+' '+item.title,55,top,w-105,48);
      ctx.font='500 36px Arial';ctx.fillStyle='#d1edda';wrap(ctx,item.room_text,89,y+10,w-155,43);
      if(index<data.achievements.length-1){ctx.strokeStyle='#d1edda30';ctx.beginPath();ctx.moveTo(55,top+112);ctx.lineTo(w-55,top+112);ctx.stroke();}
    });
  });
  monitor([1.99,1.2963,-2.55],.79,projectTexture,beige,4);
  const keyboard=new THREE.Group();keyboard.position.set(-1.30,1.38,-.98);keyboard.rotation.x=.08;keyboard.rotation.y=-.05;desk.add(keyboard);
  box(keyboard,1.56,.08,.46,[0,0,0],beige,.015);
  for(let row=0;row<4;row++)for(let key=0;key<13;key++){const keyMat=material(key===12?'#8c795e':'#d8d1b5');box(keyboard,.087,.032,.075,[-.66+key*.11,.051,-.15+row*.095],keyMat,.006);}
  box(keyboard,.5,.04,.07,[0,.05,.2],cream,.006);
  const wireMat=material('#1d241f');
  function tube(parent,points,radius,mat){const curve=new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,radius,6,false),mat);parent.add(mesh);return mesh;}
  tube(desk,[[-.58,1.36,-1.2],[-.34,1.34,-1.48],[-.32,1.34,-1.65],[-.50,1.37,-1.78]],.012,wireMat);

  const tapeColors=['#8f6243','#b7ae91','#526878','#73886a','#485b76','#9b714e'];
  const tapeItems=data.timeline.slice(0,6).map(item=>({
    name:item.organization==='Syntax Institut'?'SYNTAX · KI':item.organization.startsWith('Ostfalia')?'OSTFALIA · B.Sc.':item.organization.replace(' GmbH','').replace('Wartungs- und Industrieservice','LAGERWIRTSCHAFT'),
    stop:item.organization.includes('Syntax')||item.organization.includes('Ostfalia')?3:2
  }));
  tapeItems.push({name:'n8n / WORKFLOWS',stop:4});
  const tapes=new THREE.Group();tapes.position.set(.40,1.3775,-2.40);tapes.rotation.y=-.06;desk.add(tapes);
  tapeItems.forEach(({name,stop},index)=>{
    const caseMat=material(tapeColors[index]??'#ffffff');const group=new THREE.Group();group.position.set(index%2*.06,index*.125,0);group.rotation.y=(random()-.5)*.09;tapes.add(group);
    box(group,1.02,.115,.60,[0,0,0],caseMat,.014);box(group,.95,.015,.52,[0,.06,0],black);
    const spine=texture(768,96,ctx=>{ctx.fillStyle='#e2d7b5';ctx.fillRect(0,0,768,96);ctx.fillStyle='#283932';ctx.font='bold 31px Courier New';ctx.fillText(name.toUpperCase(),20,60);ctx.font='20px Courier New';});label(group,.93,.08,[0,0,.313],spine);
    pick(group,stop,{width:.93,height:.08,at:[0,0,.317]});
  });

  const careerTexture=textTexture(1200,1500,(ctx,w,h)=>{
    ctx.fillStyle='#ede4cb';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#b5685820';ctx.beginPath();ctx.moveTo(93,0);ctx.lineTo(93,h);ctx.stroke();
    ctx.fillStyle='#183127';ctx.font='bold 64px Courier New';ctx.fillText('MEIN WEG',128,105);ctx.font='bold 26px Arial';ctx.fillText('TECHNIK / DATEN / ZUSAMMENARBEIT',130,158);
    const drawCareer=(ctx)=>{
    let y=244;
    data.timeline.filter(item=>!item.organization.includes('Syntax')&&!item.organization.includes('Ostfalia')).forEach(item=>{
      ctx.font='bold 32px Courier New';ctx.fillStyle='#284b3b';ctx.fillText(item.start.slice(5)+'/'+item.start.slice(2,4)+' — '+item.end.slice(5)+'/'+item.end.slice(2,4),128,y);y+=49;
      ctx.fillStyle='#183127';ctx.font='bold 43px Arial';y=wrap(ctx,item.organization,128,y,w-200,53);
      ctx.font='600 32px Arial';y=wrap(ctx,item.role,128,y+7,w-200,40);
      ctx.font='500 42px Arial';
      y=(item.room_bullets?bulletList(ctx,item.room_bullets,128,y+18,w-205,53):wrap(ctx,item.room_text??item.text,128,y+18,w-205,53))+55;
    });
      return y;
    };
    const measurement=document.createElement('canvas').getContext('2d');
    const endY=drawCareer(measurement);
    const fit=Math.min(1,(h-244-55)/(endY-244));
    ctx.save();ctx.translate(128,244);ctx.scale(fit,fit);ctx.translate(-128,-244);
    drawCareer(ctx);ctx.restore();
  });
  const notebook=new THREE.Group();notebook.position.set(2.10,1.34,-.80);notebook.rotation.y=-.08;desk.add(notebook);
  box(notebook,1.64,.04,1.78,[0,0,0],material('#4b3b28'),.012);
  box(notebook,1.54,.035,1.68,[0,.026,0],cream);
  information(notebook,1.49,1.64,[0,.048,0],careerTexture,[-Math.PI/2,0,0]);
  for(let i=0;i<15;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.04,.007,6,10),bronze);ring.rotation.y=Math.PI/2;ring.position.set(-.76,.055,-.73+i*.104);notebook.add(ring);}
  pick(notebook,2,{width:1.49,height:1.64,at:[0,.053,0],rotation:[-Math.PI/2,0,0]});
  // Fountain pen: barrel, grip, metal nib, end cap and a raised pocket clip.
  const pen=new THREE.Group();pen.position.set(3.23,1.355,-.77);pen.rotation.set(0,.28,Math.PI/2);desk.add(pen);
  const penMetal=material('#cfbd8c',{metalness:.85,roughness:.24}),penBody=material('#183c37',{roughness:.28});
  cylinder(pen,.025,.026,.44,[0,0,0],penBody,20);cylinder(pen,.027,.027,.022,[0,.145,0],penMetal);
  cylinder(pen,.020,.024,.10,[0,-.27,0],black);cylinder(pen,.025,.025,.025,[0,.231,0],penMetal);
  const nib=cylinder(pen,.019,0,.10,[0,-.37,0],penMetal,4);nib.scale.z=.45;
  box(pen,.009,.13,.008,[.030,.14,.004],penMetal,.002);
  tube(pen,[[.013,.229,.004],[.034,.215,.004],[.034,.08,.004]],.005,penMetal);

  // Lamp with a metal shade and warm light under its open rim.
  const lamp=new THREE.Group();lamp.position.set(-3.05,1.3525,-1.75);desk.add(lamp);
  cylinder(lamp,.27,.31,.065,[0,0,0],bronze);
  cylinder(lamp,.023,.023,1.03,[0,.54,0],bronze,12);
  const shadeGeometry=new THREE.LatheGeometry([new THREE.Vector2(.44,0),new THREE.Vector2(.43,.035),new THREE.Vector2(.28,.28),new THREE.Vector2(.135,.52),new THREE.Vector2(.10,.55)],32);
  const shade=new THREE.Mesh(shadeGeometry,material('#a47445',{metalness:.62,roughness:.32,side:THREE.DoubleSide}));shade.position.set(.02,1.03,-.035);shade.rotation.z=0;shade.castShadow=true;lamp.add(shade);
  const lining=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.423,.016),new THREE.Vector2(.412,.040),new THREE.Vector2(.263,.28),new THREE.Vector2(.119,.52),new THREE.Vector2(.087,.54)],32),material('#e5d8b6',{side:THREE.DoubleSide,roughness:.94}));lining.position.copy(shade.position);lamp.add(lining);
  const shadeRim=new THREE.Mesh(new THREE.TorusGeometry(.435,.009,8,48),bronze);shadeRim.rotation.x=Math.PI/2;shadeRim.position.set(.02,1.04,-.035);lamp.add(shadeRim);
  const lightDisk=new THREE.Mesh(new THREE.SphereGeometry(.065,20,14),new THREE.MeshBasicMaterial({color:'#ffe6ac'}));lightDisk.position.set(.02,1.16,-.035);lamp.add(lightDisk);
  const lampGlow=new THREE.PointLight('#ffc786',12,6,2);lampGlow.position.set(-3.00,2.41,-1.75);scene.add(lampGlow);
  const lampSpot=new THREE.SpotLight('#ffe0a7',55,8,.65,.65,2);lampSpot.position.set(-2.99,2.36,-1.75);lampSpot.target.position.set(-2.7,1.32,-.6);lampSpot.castShadow=true;lampSpot.shadow.mapSize.set(1024,1024);lampSpot.shadow.bias=-.001;scene.add(lampSpot,lampSpot.target);
  // Selected walnut frame replaces the cup at the same desk position.
  const pictureFrame=new THREE.Group();pictureFrame.position.set(-2.80,1.32,-.45);pictureFrame.rotation.set(-.09,.16,0);desk.add(pictureFrame);
  const frameWood=material('#68432d',{map:woodTexture,roughness:.58});
  box(pictureFrame,1.02,.76,.045,[0,.40,-.016],darkWood,.008);
  box(pictureFrame,.94,.68,.009,[0,.40,.012],cream);
  for(const x of [-.4825,.4825])box(pictureFrame,.055,.76,.065,[x,.40,.024],frameWood,.006);
  for(const y of [.0475,.7525])box(pictureFrame,.91,.055,.065,[0,y,.024],frameWood,.006);
  const picturePlaceholder=texture(16,10,(ctx,w,h)=>{ctx.fillStyle='#727d6e';ctx.fillRect(0,0,w,h);});
  const pictureGeometry=new THREE.PlaneGeometry(.86,.50,24,16);
  const picturePanel=new THREE.Mesh(pictureGeometry,new THREE.MeshStandardMaterial({map:picturePlaceholder,roughness:1}));
  picturePanel.position.set(0,.425,.023);pictureFrame.add(picturePanel);
  const frameView=createFramedView(THREE,renderer,picturePanel);
  const frameCaption=texture(768,80,(ctx,w,h)=>{ctx.fillStyle='#ede7d0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#3c3a31';ctx.font='28px Georgia';ctx.textAlign='center';ctx.fillText('SALZGITTER FLACHSTAHL GMBH',w/2,51);});
  label(pictureFrame,.83,.086,[0,.103,.023],frameCaption,undefined,false);
  pick(pictureFrame,0,{width:1.02,height:.76,at:[0,.40,.060]});pictureFrame.userData.focus='picture';
  const frameStand=box(pictureFrame,.065,.45,.035,[0,.23,-.19],darkWood,.005);frameStand.rotation.x=.65;

  // Potted plant, using curved leaves and branches.
  const plant=new THREE.Group();plant.position.set(-3.12,1.32,-2.90);desk.add(plant);
  const terracotta=material('#8b5638');cylinder(plant,.26,.18,.40,[0,.2,0],terracotta);cylinder(plant,.28,.28,.05,[0,.41,0],terracotta);
  cylinder(plant,.23,.23,.012,[0,.435,0],material('#2d291d'));
  for(let i=0;i<11;i++){
    const angle=i*2.4,height=.65+random()*.85,spread=.25+random()*.35;
    const end=[Math.cos(angle)*spread,height,Math.sin(angle)*spread];tube(plant,[[0,.42,0],[end[0]*.3,height*.75,end[2]*.3],end],.009,green);
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),material(i%2?'#294931':'#3b5835',{roughness:.48}));leaf.scale.set(.13,.32,.025);leaf.position.set(end[0],end[1],end[2]);leaf.rotation.set(.5,angle,.5);leaf.castShadow=true;plant.add(leaf);
  }
  function smallPlant(parent,at,scale){const copy=plant.clone(true);copy.position.set(...at);copy.scale.setScalar(scale);parent.add(copy);return copy;}
  smallPlant(room,[-4.93,3.67,-3.18],.38);
  const floorPlant=smallPlant(room,[4.66,.02,-.26],.85);floorPlant.rotation.y=.8;
  // Small warm bulbs cast a few pools of light, rather than adding many shadow maps.
  const cozyBulb=new THREE.MeshBasicMaterial({color:'#ffd39a'});
  const garland=[];for(let i=0;i<11;i++){const x=-3.55+i*.58,y=4.94-.18*Math.sin(i/10*Math.PI);garland.push([x,y,-3.86]);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.031,10,8),cozyBulb);bulb.position.set(x,y-.055,-3.86);room.add(bulb);}
  tube(room,garland,.006,wireMat);
  const garlandLights=[];
  for(const x of [-2.8,1.5]){const glow=new THREE.PointLight('#ffc481',.65,3.0,2);glow.position.set(x,4.68,-3.7);scene.add(glow);garlandLights.push(glow);}
  const sconce=new THREE.Group();sconce.position.set(-5.63,3.73,-1.72);room.add(sconce);
  box(sconce,.08,.30,.19,[0,0,0],bronze,.015);tube(sconce,[[.03,-.05,0],[.23,-.05,0],[.23,.05,0]],.018,bronze);
  const globe=new THREE.Mesh(new THREE.SphereGeometry(.13,18,12),cozyBulb);globe.position.set(.23,.15,0);sconce.add(globe);
  const sconceGlow=new THREE.PointLight('#ffc385',2.8,3.2,2);sconceGlow.position.set(-5.31,3.85,-1.72);scene.add(sconceGlow);
  // The educational shelf, books and certificate.
  const shelf=new THREE.Group();shelf.position.set(-4.90,0,-3.18);room.add(shelf);
  box(shelf,1.68,3.7,.68,[0,1.85,0],darkWood);
  for(const y of [.13,1.04,1.91,2.80,3.61])box(shelf,1.78,.10,.78,[0,y,.035],wood);
  const bookNames=['KI-AGENTEN','WORKFLOWS','LOGISTIK','DATEN & APIs','PROZESSE'];
  bookNames.forEach((name,index)=>{
    const book=box(shelf,.18,.55+random()*.14,.49,[-.55+index*.23,1.37,.12],material(tapeColors[index]));book.rotation.z=(random()-.5)*.12;
    const spine=texture(128,512,ctx=>{ctx.fillStyle='#eee5cc';ctx.save();ctx.translate(82,470);ctx.rotate(-Math.PI/2);ctx.font='bold 26px Courier New';ctx.fillText(name,0,0);ctx.restore();});label(shelf,.14,.51,[-.55+index*.23,1.37,.371],spine);
  });
  const study=data.timeline.find(item=>item.organization==='Syntax Institut');
  const degree=data.timeline.find(item=>item.organization.startsWith('Ostfalia'));
  const educationTexture=textTexture(1200,1500,(ctx,w,h)=>{
    ctx.fillStyle='#ece5c9';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#6a7454';ctx.lineWidth=3;ctx.strokeRect(55,55,w-110,h-110);
    ctx.fillStyle='#203b2a';ctx.font='bold 28px Arial';ctx.fillText('WEITERBILDUNG & STUDIUM',100,126);
    ctx.save();ctx.translate(w-172,177);
    ctx.fillStyle='#8b2330';ctx.beginPath();ctx.moveTo(-42,26);ctx.lineTo(-69,141);ctx.lineTo(-22,117);ctx.lineTo(4,147);ctx.lineTo(25,34);ctx.fill();
    ctx.fillStyle='#ac3340';ctx.beginPath();ctx.moveTo(0,35);ctx.lineTo(26,145);ctx.lineTo(55,113);ctx.lineTo(91,125);ctx.lineTo(50,22);ctx.fill();
    ctx.fillStyle='#b43843';ctx.beginPath();for(let i=0;i<48;i++){const angle=i/48*Math.PI*2,r=i%2?66:77;const x=Math.cos(angle)*r,y=Math.sin(angle)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
    ctx.fillStyle='#d65b61';ctx.beginPath();ctx.arc(0,0,52,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f5c4ad';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,43,0,Math.PI*2);ctx.stroke();ctx.restore();
    ctx.font='bold 158px Georgia';ctx.fillText(String(data.metrics[1].value),98,331);ctx.font='bold 58px Georgia';ctx.fillText('UE',435,331);
    ctx.font='bold 47px Georgia';let y=wrap(ctx,'KI-Agenten & Workflows',100,427,w-200,61);
    ctx.font='600 36px Arial';y=wrap(ctx,study.organization+'\n'+study.role,100,y+25,w-200,45);
    ctx.font='500 40px Arial';y=wrap(ctx,study.text,100,y+24,w-200,52);
    ctx.font='500 35px Arial';bulletList(ctx,study.room_bullets,100,y+12,w-200,45,3);
    ctx.strokeStyle='#697758';ctx.beginPath();ctx.moveTo(100,905);ctx.lineTo(w-100,905);ctx.stroke();
    ctx.font='bold 43px Georgia';y=wrap(ctx,degree.title,100,978,w-200,54);ctx.font='600 34px Arial';y=wrap(ctx,degree.organization,100,y+21,w-200,43);ctx.font='500 38px Arial';wrap(ctx,degree.room_text??degree.text,100,y+20,w-200,50);
  });
  const certificate=new THREE.Group();certificate.position.set(-4.52,2.66,-2.71);shelf.add(certificate);certificate.position.set(-.06,2.75,.50);
  box(certificate,1.42,1.77,.08,[0,0,0],bronze,.015);information(certificate,1.30,1.64,[0,0,.047],educationTexture);
  shelf.userData.stop=3;pick(certificate,3,{width:1.30,height:1.64,at:[0,0,.052]});
  const bottomBoxes=new THREE.Group();shelf.add(bottomBoxes);for(let i=0;i<3;i++)box(bottomBoxes,.36,.48,.46,[-.45+i*.43,.41,.1],material('#59614e'),.025);

  // Skills board on the right wall. Pins, paper and tape have actual depth.
  const board=new THREE.Group();board.position.set(5.68,2.73,-1.48);board.rotation.y=-Math.PI/2;room.add(board);
  box(board,2.83,2.09,.09,[0,0,0],darkWood,.02);box(board,2.65,1.92,.06,[0,0,.072],material('#8f7954',{map:plasterTexture}));
  const skillTexture=textTexture(1600,1120,(ctx,w,h)=>{
    ctx.fillStyle='#eee6cc';ctx.fillRect(0,0,w,h);ctx.fillStyle='#183b2a';ctx.font='bold 65px Courier New';ctx.fillText('WAS ICH MITBRINGE',80,113);
    const rows=Math.ceil((data.skills.length+1)/2),rowHeight=(h-280)/rows,columnWidth=(w-240)/2;
    ctx.strokeStyle='#183b2a30';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(80,161);ctx.lineTo(w-80,161);ctx.moveTo(w/2,202);ctx.lineTo(w/2,h-85);ctx.stroke();
    for(let row=1;row<rows;row++){const y=176+row*rowHeight;ctx.beginPath();ctx.moveTo(80,y);ctx.lineTo(w-80,y);ctx.stroke();}
    data.skills.forEach((group,index)=>{
      const x=80+(index%2)*(columnWidth+80),top=225+Math.floor(index/2)*rowHeight;
      ctx.font='bold 32px Arial';const y=wrap(ctx,group.room_title.toUpperCase(),x,top,columnWidth,40);
      ctx.font='500 38px Arial';bulletList(ctx,group.room_items,x,y+21,columnWidth,48,4);
    });
    const index=data.skills.length,x=80+(index%2)*(columnWidth+80),top=225+Math.floor(index/2)*rowHeight;
    ctx.font='bold 32px Arial';ctx.fillText('SPRACHEN',x,top);ctx.font='500 36px Arial';
    data.languages.forEach((item,i)=>ctx.fillText(item.name+' · '+item.room_level,x,top+61+i*48));
  });
  const boardPaper=information(board,2.42,1.70,[0,0,.113],skillTexture);
  let portraitSkills=null;
  function fitBoard(){
    const portrait=innerWidth/innerHeight<.8;
    if(portrait&&!portraitSkills)portraitSkills=textTexture(1200,1800,(ctx,w,h)=>{
      ctx.fillStyle='#eee6cc';ctx.fillRect(0,0,w,h);ctx.fillStyle='#183b2a';
      ctx.font='bold 55px Courier New';ctx.fillText('WAS ICH MITBRINGE',74,105);let y=190;
      for(const group of data.skills){
        ctx.font='bold 40px Arial';y=wrap(ctx,group.room_title.toUpperCase(),74,y,w-148,48);
        ctx.font='500 44px Arial';y=bulletList(ctx,group.room_items,74,y+9,w-148,54,2)+22;
      }
      ctx.font='bold 40px Arial';ctx.fillText('SPRACHEN',74,y);y+=57;ctx.font='500 42px Arial';
      for(const item of data.languages){ctx.fillText(item.name+' · '+item.room_level,74,y);y+=50;}
    });
    board.scale.y=portrait?3.63/1.70:1;board.position.y=portrait?3.18:2.73;boardPaper.material.map=portrait?portraitSkills:skillTexture;
    boardPaper.material.needsUpdate=true;
  }
  fitBoard();
  for(const x of [-1.12,1.12])for(const y of [-.78,.78]){const pin=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),material('#617458',{metalness:.4}));pin.position.set(x,y,.133);board.add(pin);}pick(board,5,{width:2.42,height:1.70,at:[0,0,.119]});
  const poster=texture(16,20,(ctx,w,h)=>{ctx.fillStyle='#eae9d4';ctx.fillRect(0,0,w,h);});
  const posterPanel=label(room,1.56,1.95,[4.35,3.75,-4.45],poster,undefined,false);
  const posterView=createPosterView(THREE,renderer,posterPanel);
  pick(posterPanel,0,{width:1.56,height:1.95,at:[0,0,.008]});posterPanel.userData.focus='poster';
  for(const x of [3.64,5.07])for(const y of [2.84,4.66]){const tape=box(room,.23,.09,.008,[x,y,-4.424],material('#c6b58c'));tape.rotation.z=(x-4)*.3;}
  // A small contact table: corded telephone, open notepad and a plant.
  const contactTable=new THREE.Group();contactTable.position.set(4.75,0,-3.25);room.add(contactTable);
  box(contactTable,1.80,.13,1.80,[0,1.05,0],wood,.03);
  for(const x of [-.74,.74])for(const z of [-.73,.73])box(contactTable,.075,1.02,.075,[x,.51,z],darkWood);
  const contactTexture=textTexture(1100,1500,(ctx,w,h)=>{
    ctx.fillStyle='#eee6cc';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#b3a68b';ctx.lineWidth=2;
    for(let y=140;y<h;y+=69){ctx.beginPath();ctx.moveTo(63,y);ctx.lineTo(w-63,y);ctx.stroke();}
    ctx.fillStyle='#173b2b';ctx.font='bold 29px Arial';wrap(ctx,'KONTAKT / '+data.content.availability.toUpperCase(),76,112,w-152,38);
    ctx.font='bold italic 74px Georgia';let y=wrap(ctx,data.content.contact_title,76,279,w-152,81);
    ctx.font='600 53px Arial';y=wrap(ctx,data.name,76,y+69,w-152,65);
    ctx.font='500 54px Arial';wrap(ctx,data.content.contact_text,76,y+83,w-152,76);
  });
  const contactNote=new THREE.Group();contactNote.position.set(.34,1.14,.02);contactNote.rotation.y=-.055;contactTable.add(contactNote);
  box(contactNote,1.0,.04,1.46,[0,0,0],material('#294637'),.012);box(contactNote,.96,.025,1.42,[0,.029,0],cream);
  information(contactNote,.91,1.36,[0,.047,0],contactTexture,[-Math.PI/2,0,0]);
  for(let i=0;i<10;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.033,.006,6,12),bronze);ring.rotation.x=Math.PI/2;ring.position.set(-.40+i*.088,.060,-.695);contactNote.add(ring);}
  pick(contactNote,6,{width:.91,height:1.36,at:[0,.052,0],rotation:[-Math.PI/2,0,0]});
  const phone=new THREE.Group();phone.position.set(-.57,1.16,.23);phone.rotation.y=-.18;contactTable.add(phone);
  box(phone,.49,.13,.60,[0,0,0],material('#30433b'),.035);box(phone,.33,.03,.33,[0,.09,.08],black,.015);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)box(phone,.064,.020,.047,[-.085+col*.085,.113,-.015+row*.065],beige,.006);
  const receiver=new THREE.Group();receiver.position.set(0,.18,-.21);phone.add(receiver);
  tube(receiver,[[-.27,0,0],[-.17,.04,0],[.17,.04,0],[.27,0,0]],.045,black);
  for(const x of [-.26,.26]){const earpiece=cylinder(receiver,.071,.078,.10,[x,-.02,0],black,20);earpiece.rotation.x=.18;}
  const cord=[[-.32,.17,-.21],[-.37,.12,-.18]];
  for(let i=0;i<=90;i++){const t=i/90;cord.push([-.38-.065*Math.sin(t*Math.PI)+.018*Math.cos(t*18*Math.PI),.165*(1-t)-.035,-.18+t*.42+.018*Math.sin(t*18*Math.PI)]);}
  cord.push([-.32,-.035,.24],[-.247,.02,.18]);tube(phone,cord,.008,wireMat);
  box(phone,.022,.035,.043,[-.247,.02,.18],black,.003);
  box(phone,.025,.030,.035,[-.32,.17,-.21],black,.003);
  smallPlant(contactTable,[-.55,1.12,-.58],.29);

  const hemi=new THREE.HemisphereLight('#afc7e1','#584027',1.1);scene.add(hemi);
  const moon=new THREE.DirectionalLight('#a2bedc',1.4);moon.position.set(-.5,4.5,-3.0);scene.add(moon);
  const fill=new THREE.DirectionalLight('#eadfc9',1.0);fill.position.set(0,4,4);scene.add(fill);
  const screenLight=new THREE.PointLight('#85a3d2',2.1,4,2);screenLight.position.set(-1.3,2.7,-1.45);scene.add(screenLight);
  const boardLight=new THREE.PointLight('#e8d6af',6,7,2);boardLight.position.set(3.8,3.7,-1.1);scene.add(boardLight);
  const ambient=new THREE.AmbientLight('#e9be88',.21);scene.add(ambient);
  const camPoints=[
    [0.00,3.50,7.65],[-1.30,2.85,1.95],[2.10,3.80,.95],[-4.96,2.78,.12],[1.99,2.28,.51],[2.06,2.78,-1.48],[4.72,3.80,-1.65]
  ];
  const targetPoints=[[-.10,2.40,-2.30],[-1.30,2.40,-1.66],[2.10,1.40,-.80],[-4.96,2.75,-2.63],[1.99,2.20,-1.87],[5.60,2.73,-1.48],[4.75,1.16,-3.23]];
  const cameraCurve=new THREE.CatmullRomCurve3(camPoints.map(point=>new THREE.Vector3(...point)),false,'catmullrom',.24);
  const targetCurve=new THREE.CatmullRomCurve3(targetPoints.map(point=>new THREE.Vector3(...point)),false,'catmullrom',.20);
  const tempCamera=new THREE.Vector3(),tempTarget=new THREE.Vector3(),viewTarget=new THREE.Vector3();
  let desired=0,current=0,lastTime=0,stopped=false,paused=false,lightMode=false,direct=false,objectFocus=null;
  function setProgress(progress){desired=THREE.MathUtils.clamp(progress,0,6);}
  function focusObject(name){if(!["picture","poster"].includes(name))return;objectFocus=name;direct=true;hovered=null;}
  function goTo(index){
    objectFocus=null;
    // Skip the scroll curve's intermediate stops. Damping starts at the visible pose,
    // so another click or manual scrolling can retarget a pan without a position jump.
    desired=current=THREE.MathUtils.clamp(index,0,6);direct=true;
    hovered=null;renderer.domElement.style.cursor='default';
  }
  function setLight(bright){
    lightMode=bright;windowView.setDay(bright);
    hemi.color.set(bright?'#e0f0ff':'#afc7e1');hemi.intensity=bright?2.8:1.1;
    moon.color.set(bright?'#fff1da':'#a2bedc');moon.intensity=bright?3.1:1.4;
    fill.intensity=bright?1.6:1.0;ambient.intensity=bright?.34:.21;
    lampGlow.intensity=bright?2.4:12;lampSpot.intensity=bright?12:55;
    sconceGlow.intensity=bright?.4:2.8;
    for(const glow of garlandLights)glow.intensity=bright?.10:.65;
    cozyBulb.color.set(bright?'#b8ac94':'#ffd39a');
    lightDisk.material.color.set(bright?'#d4ccba':'#ffe6ac');
    screenLight.intensity=bright?.8:2.1;boardLight.intensity=bright?3.5:6;
    renderer.toneMappingExposure=bright?1.20:1.12;
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const occluders=[];room.traverse(object=>{if(object.isMesh&&!object.userData.glimmer)occluders.push(object);});
  let hovered=null;
  function hit(event){const bounds=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(occluders,false);if(!hits.length)return null;let object=hits[0].object;while(object && object.userData.stop===undefined&&!object.userData.focus)object=object.parent;return object??null;}
  renderer.domElement.addEventListener('pointermove',event=>{hovered=hit(event);renderer.domElement.style.cursor=hovered?'pointer':'default';});
  renderer.domElement.addEventListener('pointerleave',()=>{hovered=null;renderer.domElement.style.cursor='default';});
  let pointerStart=null;renderer.domElement.addEventListener('pointerdown',event=>{pointerStart=[event.clientX,event.clientY];});
  renderer.domElement.addEventListener('pointerup',event=>{if(!pointerStart)return;const distance=Math.hypot(event.clientX-pointerStart[0],event.clientY-pointerStart[1]);pointerStart=null;if(distance>8)return;const selected=hit(event);if(selected)onSelect(selected.userData.focus??selected.userData.stop);});
  renderer.domElement.addEventListener('pointercancel',()=>{pointerStart=null;hovered=null;});
  function resize(){fitBoard();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);}
  addEventListener('resize',resize);
  function animate(time){
    if(stopped)return;
    const dt=Math.min((time-lastTime)/1000,.06);lastTime=time;
    if(paused){requestAnimationFrame(animate);return;}
    const delta=desired-current;current=reduced.matches?Math.round(desired):Math.abs(delta)<.0004?desired:current+delta*(1-Math.exp(-dt*8));
    const index=Math.min(5,Math.floor(current)),fraction=current-index;
    const eased=reduced.matches?current: index+THREE.MathUtils.smoothstep(fraction,.10,.90);
    const t=THREE.MathUtils.clamp(eased/6,0,1);
    cameraCurve.getPoint(t,tempCamera);targetCurve.getPoint(t,tempTarget);
    if(objectFocus==='picture'){tempCamera.set(-2.55,1.93,1.15);tempTarget.set(-2.80,1.72,-.43);}
    if(objectFocus==='poster'){tempCamera.set(4.35,3.75,-.30);tempTarget.set(4.35,3.75,-4.45);}
    const narrow=camera.aspect<.8;
    const boardFocus=narrow&&!objectFocus?1-THREE.MathUtils.smoothstep(Math.abs(eased-5),0,.5):0;
    const contactFocus=narrow&&!objectFocus?1-THREE.MathUtils.smoothstep(Math.abs(eased-6),0,.5):0;
    const fit=narrow&&objectFocus==='poster'?Math.max(1,.54/camera.aspect):narrow?THREE.MathUtils.lerp(THREE.MathUtils.lerp(Math.min(2.15,.83/camera.aspect),Math.min(3.1,1.10/camera.aspect),boardFocus),1.15,contactFocus):1;
    if(fit>1)tempCamera.sub(tempTarget).multiplyScalar(fit).add(tempTarget);
    // Keep the whole board visible above the foreground monitors on phones.
    tempCamera.y+=boardFocus*2.45;tempTarget.y-=boardFocus*.45;
    if(narrow)tempCamera.y=Math.min(tempCamera.y,5.25);
    tempCamera.x+=contactFocus*.30;tempTarget.x+=contactFocus*.30;
    if(direct&&!reduced.matches){
      const blend=1-Math.exp(-dt*7);
      camera.position.lerp(tempCamera,blend);viewTarget.lerp(tempTarget,blend);
      if(camera.position.distanceToSquared(tempCamera)<.000001&&viewTarget.distanceToSquared(tempTarget)<.000001)direct=false;
    }else direct=false;
    if(!direct){camera.position.copy(tempCamera);viewTarget.copy(tempTarget);}
    camera.lookAt(viewTarget);
    if(!reduced.matches)for(const update of animated)update(time/1000);else for(const update of animated)update(0);
    for(const item of interactive){item.glow.uniforms.time.value=reduced.matches?0:time/1000;const focus=hovered===item.group?1:0;item.glow.uniforms.focus.value=THREE.MathUtils.damp(item.glow.uniforms.focus.value,focus,10,dt);}
    renderer.render(scene,camera);
    renderer.domElement.dataset.camera=camera.position.toArray().map(value=>value.toFixed(3)).join(',');
    renderer.domElement.dataset.target=viewTarget.toArray().map(value=>value.toFixed(3)).join(',');
    renderer.domElement.dataset.navigation=direct?'direct':'scroll';
    renderer.domElement.dataset.focus=objectFocus??'';
    renderer.domElement.dataset.stop=String(Math.round(current));
    renderer.domElement.dataset.progress=current.toFixed(3);
    renderer.domElement.dataset.lighting=lightMode?'day':'night';
    requestAnimationFrame(animate);
  }
  resize();animate(0);
  renderer.domElement.dataset.ready='true';
  return {setProgress,goTo,focusObject,setLight,resize,isMoving:()=>direct,setPaused(value){paused=value;},dispose(){frameView.dispose();posterView.dispose();windowView.dispose();stopped=true;removeEventListener('resize',resize);scene.traverse(object=>{object.geometry?.dispose();if(object.material){for(const mat of Array.isArray(object.material)?object.material:[object.material]){mat.map?.dispose();mat.dispose();}}});renderer.dispose();},getCurrent:()=>current};
}
