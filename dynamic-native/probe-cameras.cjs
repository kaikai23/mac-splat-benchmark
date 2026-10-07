'use strict';
function cameras(inspection){
  const bounds=inspection.fullBounds||inspection.bounds;
  if(!bounds?.min||!bounds?.max)throw Error('Full actual Gaussian bounds required');
  const center=bounds.min.map((v,i)=>(v+bounds.max[i])/2),radius=Math.hypot(...bounds.max.map((v,i)=>(v-bounds.min[i])/2));
  if(!(radius>0&&Number.isFinite(radius)))throw Error('Invalid content bounds');
  const normalize=a=>{const s=Math.hypot(...a);return a.map(v=>v/s);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const view=(direction,up)=>{
    const outward=normalize(direction),forward=outward.map(v=>-v),right=normalize(cross(forward,up)),down=cross(forward,right);
    return {position:center.map((v,i)=>v+outward[i]*radius/Math.sin(25*Math.PI/180)*1.1),rotation:[0,1,2].map(i=>[right[i],down[i],forward[i]]),fx:720/(2*Math.tan(25*Math.PI/180)),fy:720/(2*Math.tan(25*Math.PI/180)),width:1280,height:720,source:'Union of actual opacity>0.02 Gaussian center bounds at normalized t=0,0.5,1; static diagnostic view; no model transform',target:center};
  };
  return {front_y_up:view([0,0,1],[0,1,0]),front_z_up:view([0,-1,0],[0,0,1]),oblique_z_up:view([1,-1,0.45],[0,0,1])};
}
module.exports={cameras};
