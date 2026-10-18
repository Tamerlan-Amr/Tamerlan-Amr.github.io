// Input state only; the room and the document remain owned by website.js.
export function createMobileSteps({move,isMoving,now=()=>performance.now(),threshold=44,rest=10,wheelGap=220}) {
  let awaitingArrival=false,restUntil=0,touch=null;
  let wheelAt=-Infinity,wheelDistance=0,wheelUsed=false;
  function isLocked(){
    if(awaitingArrival&&!isMoving()){awaitingArrival=false;restUntil=now()+rest;}
    return awaitingArrival||now()<restUntil;
  }
  function hold(){
    awaitingArrival=true;wheelDistance=0;wheelUsed=true;
    if(touch)touch.used=true;
  }
  function step(direction){
    if(isLocked()||move(direction)===false)return false;
    hold();return true;
  }
  function touchStart(x,y){touch={x,y,used:isLocked()};}
  function touchMove(x,y){
    if(!touch||touch.used)return false;
    if(isLocked()){touch.used=true;return false;}
    const dx=x-touch.x,dy=touch.y-y;
    if(Math.abs(dy)<threshold||Math.abs(dy)<Math.abs(dx)*1.2)return false;
    touch.used=true;return step(Math.sign(dy));
  }
  function wheel(delta){
    const time=now();
    if(time-wheelAt>wheelGap){wheelUsed=false;wheelDistance=0;}
    wheelAt=time;
    if(wheelUsed)return false;
    if(isLocked()){wheelUsed=true;return false;}
    wheelDistance+=delta;
    if(Math.abs(wheelDistance)<threshold)return false;
    wheelUsed=true;return step(Math.sign(wheelDistance));
  }
  function reset(){awaitingArrival=false;restUntil=0;touch=null;wheelAt=-Infinity;wheelDistance=0;wheelUsed=false;}
  return {hold,isLocked,step,touchStart,touchMove,touchEnd(){touch=null;},wheel,reset};
}
