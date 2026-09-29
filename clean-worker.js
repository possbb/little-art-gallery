// Estimate the paper illumination from bright, low-chroma pixels in broad tiles.
// No generative model: the original geometry and strokes remain in place.
export function cleanPixels(data,width,height,mode,strength) {
  const size=Math.max(64,Math.round(Math.max(width,height)/10));
  const cols=Math.ceil(width/size),rows=Math.ceil(height/size);
  const paper=new Float32Array(cols*rows*3),global=[[],[],[]];
  const tiles=Array.from({length:cols*rows},()=>[[],[],[]]);
  for(let y=0;y<height;y+=3)for(let x=0;x<width;x+=3){
    const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    if(Math.max(r,g,b)-Math.min(r,g,b)>65||Math.min(r,g,b)<90)continue;
    const tile=tiles[Math.floor(y/size)*cols+Math.floor(x/size)];
    [r,g,b].forEach((v,c)=>{tile[c].push(v);global[c].push(v);});
  }
  const percentile=(values,fallback)=>{if(!values.length)return fallback;values.sort((a,b)=>a-b);return values[Math.floor((values.length-1)*.88)];};
  const base=global.map(v=>percentile(v,245));
  tiles.forEach((tile,i)=>tile.forEach((v,c)=>{paper[i*3+c]=v.length>=12?percentile(v,base[c]):base[c];}));
  const amount=Math.max(0,Math.min(100,Number(strength)))/100;
  const output=new Uint8ClampedArray(data.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,gx=Math.max(0,Math.min(cols-1,(x+.5)/size-.5)),gy=Math.max(0,Math.min(rows-1,(y+.5)/size-.5));
    const x0=Math.floor(gx),y0=Math.floor(gy),x1=Math.min(cols-1,x0+1),y1=Math.min(rows-1,y0+1),fx=gx-x0,fy=gy-y0;
    const rgb=[0,1,2].map(c=>{
      const bg=(paper[(y0*cols+x0)*3+c]*(1-fx)+paper[(y0*cols+x1)*3+c]*fx)*(1-fy)+(paper[(y1*cols+x0)*3+c]*(1-fx)+paper[(y1*cols+x1)*3+c]*fx)*fy;
      const normalized=Math.min(255,data[i+c]*255/Math.max(110,bg));
      const white=255-amount*10;
      return Math.max(0,Math.min(255,normalized*255/white));
    });
    if(mode==='line'){
      const gray=.299*rgb[0]+.587*rgb[1]+.114*rgb[2];
      const ink=Math.max(0,Math.min(255,255-(255-gray)*(1+amount*1.5)));
      output[i]=output[i+1]=output[i+2]=ink;
    }else for(let c=0;c<3;c++)output[i+c]=rgb[c];
    output[i+3]=255;
  }
  return output;
}
if(typeof self!=='undefined')self.onmessage=({data:{pixels,width,height,mode,strength}})=>{
  try{const result=cleanPixels(pixels,width,height,mode,strength);self.postMessage({pixels:result},[result.buffer]);}
  catch{self.postMessage({error:'处理失败，请缩小图片后重试。'});}
};
