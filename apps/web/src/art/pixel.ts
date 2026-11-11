/** Pixel-art helpers: turn a character grid + palette into a crisp SVG data URL.
 * All Saltwake art is original and drawn in this repository (see docs/systems/LOOK-FEEL-NOTES.md). */
export type Palette=Record<string,string>;

/** Shared palette so every sprite and tile reads as one set. */
export const P:Palette={
 k:'#1b1714',K:'#2f2822',w:'#f4ead0',W:'#c9bc98',
 s:'#e3b48c',S:'#b57f5c',h:'#6e4a30',H:'#4a3020',
 y:'#d9b45a',Y:'#9e7a34',o:'#e88a3a',O:'#a8501c',
 g:'#a9bbbe',G:'#647579',n:'#3f4c50',
 r:'#c9462f',R:'#7e2418',p:'#e7a28c',
 m:'#64907a',M:'#3c5c4c',l:'#9cc49a',
 b:'#8c5c36',B:'#5a3a22',d:'#c09060',
 f:'#a99d88',F:'#6f6555',e:'#ffd85e',E:'#fff6b0',
 c:'#5fa7b6',C:'#2f6a78',u:'#8fd3dc',v:'#7a5ea8',V:'#4c3a6e',
 x:'#2a2f2c',X:'#454b44',z:'#d84a3a',
};

const cache=new Map<string,string>();
/** Rows of equal length; '.' is transparent. Horizontal runs are merged into single rects. */
export function pixelSvg(rows:readonly string[],palette:Palette=P,flip=false):string{
 const h=rows.length,w=Math.max(...rows.map(r=>r.length));let out='';
 for(let y=0;y<h;y++){const row=flip?[...rows[y].padEnd(w,'.')].reverse().join(''):rows[y].padEnd(w,'.');
  for(let x=0;x<w;){const ch=row[x];let n=1;while(x+n<w&&row[x+n]===ch)n++;const fill=palette[ch];if(ch!=='.'&&fill)out+=`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${fill}"/>`;x+=n;}
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${out}</svg>`;
}
export function dataUrl(svg:string){return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;}
export function pixelUrl(key:string,rows:readonly string[],flip=false,palette:Palette=P){
 const k=key+(flip?':f':'');let u=cache.get(k);if(!u){u=dataUrl(pixelSvg(rows,palette,flip));cache.set(k,u);}return u;
}

/** Small deterministic PRNG for procedural tiles. */
export function rng(seed:number){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
