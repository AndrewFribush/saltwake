/** Saltwake sprite sheet: original 16×16 pixel art, one shared palette (pixel.ts).
 * Side-view sprites face right; renderers mirror them for left. */
import {P,pixelSvg,dataUrl,rng,type Palette} from './pixel';

export const heroDown=[
 '................','.....kkkkkk.....','....khhhhhhk....','...khhHhhHhhk...','...khsssssshk...','...khsksskshk...','...kHssSSssHk...','....kyssssyk....',
 '...kyyyYYyyyk...','..kyyyyYYyyyyk..','..ksyybbbbyyskg.','...kyyyYYyyykg..','...kYyyyyyyYk.g.','....kYYk.kYYk...','....kBBk.kBBk...','....kkkk.kkkk...'];
export const heroUp=[
 '................','.....kkkkkk.....','....khhhhhhk....','...khhhhhhhhk...','...khhhHHhhhk...','...khhHhhHhhk...','...kHhhhhhhhk...','....kyhhhhyk....',
 '...kyyyYYyyyk...','..kyyyyYYyyyyk..','.gksyyYYYYyyskk.','.g.kyyyYYyyyk...','.g.kYyyyyyyYk...','....kYYk.kYYk...','....kBBk.kBBk...','....kkkk.kkkk...'];
export const heroSide=[
 '................','......kkkkk.....','.....khhhhhk....','....khhhhhhhk...','....khhhhsssk...','....khhhssksk...','....kHhhssssk...','.....kyyssk.....',
 '....kyyyyyyk....','...kyyyyyyyyk...','...kyYbbbbsskg..','...kyYyyyyyk.g..','...kYYyyyyYk.g..','....kYYkYYk.....','....kBBkkBBk....','....kkkk.kkk....'];

const stride=(rows:readonly string[],legs:string[])=>[...rows.slice(0,13),...legs];
export const heroDownWalk=stride(heroDown,['....kYYk.kYYk...','....kBBk..kkk...','....kkkk........']);
export const heroUpWalk=stride(heroUp,['....kYYk.kYYk...','....kBBk..kkk...','....kkkk........']);
export const heroSideWalk=stride(heroSide,['...kYYk..kYYk...','..kBBk....kBBk..','..kkk......kkk..']);

const rat=[
 '................','................','................','................','................','................','................','..........kk....',
 '.........kpfk...','...kkkkkkkffkk..','..kffffffffkfek.','.kfffFffffffffpk','kfkFFFfffffffkk.','k..kFFFFFFFFFk..','.k..kpk...kpk...','................'];
const boar=[
 '................','................','................','................','................','....kkkkkkk.....','..kkbbbbbbbkk...','.kbbbBbbbBbbbkk.',
 'kbbBbbbbbbbbbbbk','kbBbbbbbbbbbkebk','kBBbbbbbbbbbbddk','.kBBBBbbbbbbbwdk','..kBBBBBBBBkkwk.','..kBk.kBk.kBk...','..kkk.kkk.kkk...','................'];
const sentry=[
 '................','.....kkkkk......','....kgggggk.....','....kgGGGGgk....','....kgkkkkgk....','....kgGeGGgk....','.....kggggk.....','....knnnnnnk....',
 '...knnggggnnkgk.','...kngnnnbbbbbbk','...kngnnnnnkgk..','...knnnnnnnk....','....kGGGGGk.....','....kGk.kGk.....','....kkk.kkk.....','................'];
const crab=[
 '................','................','................','........E.......','.......eo.......','.......k........','.....kkkkkk.....','...kkrrrrrrkk...',
 '..krrrprrrrrrk..','kkrrrrrrrrrrrrkk','krkrrrrrrrrrrkrk','kk.kRRRRRRRRk.kk','...kekRRRRkek...','..k.k.k..k.k.k..','................','................'];
const brute=[
 '....kkkkkkkk....','...kmmmmmmmmk...','..kmmMmmmmMmmk..','..kmkekmmkekmk..','..kmmmmMMmmmmk..','..kMmwwwwwwmMk..','.kkMMMMMMMMMMkk.','kmmmmmmmmmmmmmmk',
 'kmMmmmmmmmmmmMmk','kmMmmmMMMMmmmMmk','kmmkmmmmmmmmkmmk','kllkMMMMMMMMkllk','kkk.kMMMMMMk.kkk','....kMMk.kMMk...','...kkMMk.kMMkk..','...kkkkk.kkkkk..'];
const nest=[
 '................','................','................','................','................','................','.....d....d.....','......d..d......',
 '......kkkk......','....kkbddbkk....','...kbbdbbdbbk...','..kbdbbkkbbdbk..','.kbbbbkqqkbbbbk.','kbdbbbkqekbbdbbk','kBBBBBBBBBBBBBBk','.kkkkkkkkkkkkkk.'];
const keg=[
 '................','........e.......','........k.......','.....kkkkkk.....','....kbbbbbbk....','...kggggggggk...','...kbbBbbBbbk...','...krrrrrrrrk...',
 '...krwrrwrrrk...','...kbbBbbBbbk...','...kggggggggk...','...kbbBbbBbbk...','...kbbBbbBbbk...','...kggggggggk...','....kbbbbbbk....','.....kkkkkk.....'];
const cache=[
 '................','................','................','................','..kkkkkkkkkkkk..','..kddddddddddk..','..kbbbbbbbbbbk..','..kdddkyykdddk..',
 '..kdddkyykdddk..','..kbbbbbbbbbbk..','..kddddddddddk..','..kbbbbbbbbbbk..','..kkkkkkkkkkkk..','................','................','................'];
const loot=[
 '................','................','...........E....','..........EwE...','...........E....','....kkkkkkkk....','...kbbbbbbbbk...','..kbddddddddbk..',
 '..kkkkkyykkkkk..','..kbbbkeekbbbk..','..kbbbbkkbbbbk..','..kbbbbbbbbbbk..','..kkkkkkkkkkkk..','................','................','................'];
const fountain=[
 '................','................','................','................','.......uu.......','......u..u......','.......cc.......','.......gg.......',
 '...kkkkggkkkk...','..kggggggggggk..','..kgccucccccgk..','..kGccccccccGk..','...kGGGGGGGGk...','....kkkkkkkk....','................','................'];
const altar=[
 '................','................','................','...E........E...','...e........e...','...w........w...','..kkkkkkkkkkkk..','..kRrrrrrrrrRk..',
 '..kggggggggggk..','..kgGGkzzkGGgk..','..kgGGkzzkGGgk..','..kggggggggggk..','..kGGGGGGGGGGk..','..kkkkkkkkkkkk..','................','................'];
const crack=[
 '................','................','.......k........','......kk........','......kW........','.....kk...k.....','.....k...kk.....','....kkk.kkW.....',
 '......kkk.......','.......kW.......','......kk.k......','.....kW...kk....','....k......k....','................','................','................'];
const spikesArmed=[
 '................','................','................','................','..w....w....w...','..g....g....g...','.kgk..kgk..kgk..','.kgGk.kgGk.kgGk.',
 'kggGkkggGkkggGk.','kGGGGkGGGGkGGGGk','kkkkkkkkkkkkkkkk','XXXXXXXXXXXXXXXX','XxXXXxXXXxXXXxXX','XXXXXXXXXXXXXXXX','................','................'];
const spikesSafe=[
 '................','................','................','................','................','................','................','................',
 '................','................','................','XXXXXXXXXXXXXXXX','XkXXXkXXXkXXXkXX','XXXXXXXXXXXXXXXX','................','................'];
const stairs=[
 'XXXXXXXXXXXXXXXX','XwwwwwwwwwwwwwwX','XWWWWWWWWWWWWWWX','XkkkkkkkkkkkkkkX','XkwwwwwwwwwwwwkX','XkWWWWWWWWWWWWkX','XkkkkkkkkkkkkkkX','XkkwwwwwwwwwwkkX',
 'XkkWWWWWWWWWWkkX','XkkkkkkkkkkkkkkX','XkkkwwwwwwwwkkkX','XkkkWWWWWWWWkkkX','XkkkkkkkkkkkkkkX','XkkkkqqqqqqkkkkX','XkkkkqqqqqqkkkkX','XXXXXXXXXXXXXXXX'];
const flame=[[
 '................','................','.......o........','......oo........','......ooo..o....','.....oeoo.oo....','....ooeeooooo...','...ooeEeeoeoo...',
 '...oeeEEeeeeo...','..ooeEEEEeeoo...','..oeeEEEEEeeo...','...oeeEEEeeo....','....ooeeeoo.....','................','................','................'],[
 '................','........o.......','........oo......','...o...ooo......','...oo..oeoo.....','....ooooeeo.....','...ooeeooeeo....','...oeeEeeeeoo...',
 '..ooeEEEeeEeo...','..oeeEEEEEeeo...','..oeeEEEEeeoo...','...ooeEEeeo.....','.....oeeoo......','................','................','................']];
// Furniture for interiors.
const counter=[
 '................','................','................','................','kkkkkkkkkkkkkkkk','kddddddddddddddk','kbbbbbbbbbbbbbbk','kBBBBBBBBBBBBBBk',
 'kbbkbbbbbbbbkbbk','kbbkbbbbbbbbkbbk','kbbkbbbbbbbbkbbk','kbbkbbbbbbbbkbbk','kBBkBBBBBBBBkBBk','kkkkkkkkkkkkkkkk','................','................'];
const bed=[
 '................','..kkkkkkkkkkkk..','..kwwwwwwwwwwk..','..kwWWWWWWWWwk..','..kkkkkkkkkkkk..','..kcccccccccck..','..kcCcccccCcck..','..kccccccccCck..',
 '..kcCcccccccck..','..kcccccCcccck..','..kCccccccccCk..','..kcccccccccck..','..kCCCCCCCCCCk..','..kbbkkkkkkbbk..','..kkk......kkk..','................'];
const chest=[
 '................','................','................','................','...kkkkkkkkkk...','..kbbbbbbbbbbk..','..kbddddddddbk..','..kkkkkyykkkkk..',
 '..kbbbkyykbbbk..','..kbbbbkkbbbbk..','..kbbbbbbbbbbk..','..kBBBBBBBBBBk..','..kkkkkkkkkkkk..','................','................','................'];
const shelves=[
 '..kkkkkkkkkkkk..','..kbbbbbbbbbbk..','..kbrkcyykgwbk..','..kbrkcyykgwbk..','..kBBBBBBBBBBk..','..kbbbbbbbbbbk..','..kbwwkmmkyykk..','..kbwwkmmkyykk..',
 '..kBBBBBBBBBBk..','..kbbbbbbbbbbk..','..kbyykrrkcckk..','..kbyykrrkcckk..','..kBBBBBBBBBBk..','..kbk......kbk..','..kkk......kkk..','................'];
const book=[
 '................','................','................','.....kkkkk......','....kgggggk.....','....kk.k.kk.....','..kkkkkkkkkkkk..','..kwwwwwkwwwwk..',
 '..kwkkwwkwkkwk..','..kwwwwwkwwwwk..','..kwkkwwkwkkwk..','..krrrrrkrrrrk..','..kkkkkkkkkkkk..','...kbk....kbk...','...kkk....kkk...','................'];
const kettle=[
 '................','.....w..w.......','......w..w......','....kkkkkkkk....','...klllllllk....','..kkkkkkkkkkk...','..kXXXXXXXXXk...','.kXXxXXXXXXXXk..',
 '.kXXxXXXXXXXXk..','.kXXXXXXXXXXXk..','..kXXXXXXXXXk...','...kkkkkkkkk....','...ooeooeooo....','..kkkkkkkkkkk...','................','................'];
const banner=[
 '................','.kkkkkkkkkkkkk..','.kbbbbbbbbbbbk..','..krrrrrrrrrk...','..krrryyyrrrk...','..krryrrryrrk...','..krrryyyrrrk...','..krrrryrrrrk...',
 '..krrrryrrrrk...','..krrrrrrrrrk...','..krrrkkkrrrk...','..krrk...krrk...','..kkk.....kkk...','................','................','................'];
const scales=[
 '................','.......kk.......','.......yy.......','.kkkkkkyykkkkkk.','.k.....yy.....k.','k.k....yy....k.k','k..k...yy...k..k','kyyyk..yy..kyyyk',
 '.kkk...yy...kkk.','.......yy.......','.......yy.......','.....kkyykk.....','....kYYYYYYk....','...kkkkkkkkkk...','................','................'];
const swords=[
 '................','.k..........k...','.kgk......kgk...','..kgk....kgk....','...kgk..kgk.....','....kgkkgk......','.....kggk.......','.....kggk.......',
 '....kgkkgk......','...kykk.kyk.....','..kyk....kyk....','.kbk......kbk...','.kk........kk...','................','................','................'];
const barrels=[
 '................','................','..kkkk...kkkk...','.kbbbbk.kbbbbk..','.kggggk.kggggk..','.kbBbbk.kbBbbk..','.kbBbbk.kbBbbk..','.kggggk.kggggk..',
 '.kbbbbk.kbbbbk..','..kkkk...kkkk...','.....kkkk.......','....kbbbbk......','....kggggk......','....kbBbbk......','....kggggk......','.....kkkk.......'];
const door=[
 '..kkkkkkkkkkkk..','.kbbbbbbbbbbbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbByek.',
 '.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','.kbBbbbBbbbBbbk.','kkkkkkkkkkkkkkkk','WWWWWWWWWWWWWWWW'];

const coin=[
 '................','.....kkkkkk.....','...kkyyyyyykk...','..kyyEEyyyyyYk..','..kyEyyYYYyyYk..','.kyyEyYyyyYyyYk.','.kyyyyYyyyyyyYk.','.kyyyyyYYYyyyYk.',
 '.kyyyyyyyyYyyYk.','.kyyyyYyyyYyyYk.','.kyyyyyYYYyyYYk.','..kyyyyyyyyYYk..','..kYyyyyyyYYYk..','...kkYYYYYYkk...','.....kkkkkk.....','................'];
const drafting=[
 '................','................','..kkkkkkkkkkkk..','.kwwwwwwwwwwwwk.','.kwcwwwwwcccwwk.','.kwcccwwwwwcwwk.','.kwwwcwwcccwwwk.','.kwwwcccwwwwwgk.',
 '.kkkkkkkkkkkkkgk','..kbbbbbbbbbbkk.','..kbk......kbk..','..kbk......kbk..','..kbk......kbk..','..kBk......kBk..','..kkk......kkk..','................'];
const notice=[
 '................','..kkkkkkkkkkkk..','..kbbbbbbbbbbk..','..kbwwwbdbwwbk..','..kbwkwbdbwkbk..','..kbwwwbbbwwbk..','..kbbbwwwwbbbk..','..kbbbwkkwbbbk..',
 '..kbbbwwwwbbbk..','..kbbbbbbbbbbk..','..kkkkkbbkkkkk..','......kbbk......','......kbbk......','......kBBk......','.....kkkkkk.....','................'];
const display=[
 '..kkkkkkkkkkkk..','..kuuuuuuuuuuk..','..kucccucccuuk..','..kuyyuurruuuk..','..kkkkkkkkkkkk..','..kuuuuuuuuuuk..','..kuggukmmkuuk..','..kuggukmmkuuk..',
 '..kkkkkkkkkkkk..','..kbbbbbbbbbbk..','..kbddddddddbk..','..kbbbbbbbbbbk..','..kBBBBBBBBBBk..','..kbk......kbk..','..kkk......kkk..','................'];
export const spriteMaps={heroDownWalk,heroUpWalk,heroSideWalk,coin,drafting,notice,display,heroDown,heroUp,heroSide,rat,boar,sentry,crab,brute,nest,keg,cache,loot,fountain,altar,crack,spikesArmed,spikesSafe,stairs,counter,bed,chest,shelves,book,kettle,banner,scales,swords,barrels,door};
export type SpriteName=keyof typeof spriteMaps;
const pal:Palette={...P,q:'#07090b'};
/** Shopkeeper: the hero drawing with a blue coat and grey hair. */
const keeperPal:Palette={...pal,y:'#5f84a6',Y:'#3e5c7a',h:'#b9b3a2',H:'#857f70',b:'#e8dcc0'};
export const keeperUrl=dataUrl(pixelSvg(heroDown,keeperPal));
const urls=new Map<string,string>();
export function spriteUrl(name:SpriteName,flip=false){const k=name+(flip?':f':'');let u=urls.get(k);if(!u){u=dataUrl(pixelSvg(spriteMaps[name],pal,flip));urls.set(k,u);}return u;}
/** Two-frame flame strip (32×16) for burning oil and lit fuses. */
export const flameStrip=dataUrl(pixelStrip(flame));

function pixelStrip(frames:string[][]){
 const inner=frames.map((f,i)=>pixelSvg(f,pal).replace(/^<svg[^>]*>/,`<g transform="translate(${i*16} 0)">`).replace('</svg>','</g>')).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frames.length*16} 16" shape-rendering="crispEdges">${inner}</svg>`;
}

// ---- Procedural 16×16 tiles ------------------------------------------------------------
type Px=(x:number,y:number)=>string|null;
function tile(draw:Px,size=16){let out='';for(let y=0;y<size;y++)for(let x=0;x<size;){const c=draw(x,y);let n=1;while(x+n<size&&draw(x+n,y)===c)n++;if(c)out+=`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${c}"/>`;x+=n;}return dataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${out}</svg>`);}
function noiseGrid(seed:number,size=16){const r=rng(seed);return Array.from({length:size*size},()=>r());}
const pick=(n:number,cols:string[])=>cols[Math.min(cols.length-1,Math.floor(n*cols.length))];

function flagstones(seed:number,base:string[],grout:string,speck:string){
 const n=noiseGrid(seed),r=rng(seed+7),offs=[Math.floor(r()*4),Math.floor(r()*4)],tone=[0,1,2,3].map(()=>base[Math.floor(r()*base.length)]);
 return tile((x,y)=>{const row=y<8?0:1,sx=(x+(row?offs[1]+4:offs[0]))%16,cell=(sx<8?0:1)+row*2;
  if(y===0||y===8||sx===0||sx===8)return grout;const v=n[y*16+x];if(v>.94)return speck;if(v<.05)return grout;return tone[cell];});
}
function bricks(seed:number){
 const n=noiseGrid(seed);
 return tile((x,y)=>{if(y<3)return y===0?'#7d8670':y===1?'#66705c':'#4d5647';
  const row=Math.floor((y-3)/4),by=(y-3)%4,sx=(x+(row%2?4:0))%8;if(by===3||sx===0)return '#1f2420';
  const v=n[y*16+x];return v>.85?'#47513f':v<.12?'#2c332b':row%2?'#3b4337':'#363e33';});
}
function grass(seed:number){const n=noiseGrid(seed);return tile((x,y)=>{const v=n[y*16+x];return v>.95?'#5f804c':v>.88?'#4b6c41':v<.06?'#334b33':pick(n[(y*7+x*3)%256],['#3a5638','#3d5a3a','#38533a']);});}
function cobbles(seed:number){
 const n=noiseGrid(seed);return tile((x,y)=>{const row=Math.floor(y/5),sx=(x+(row%2?3:0))%6,by=y%5;if(by===4||sx===5)return '#6c6452';const v=n[y*16+x];
  if(by===0&&sx<4)return '#968a6e';return v>.9?'#928669':v<.08?'#776e59':'#857a61';});
}
function water(seed:number){const n=noiseGrid(seed);return tile((x,y)=>{const wave=(y===4&&x>2&&x<9)||(y===5&&(x===2||x===9))||(y===12&&x>8&&x<15)||(y===13&&(x===8||x===15));if(wave)return '#6aa2ab';const v=n[y*16+x];return v>.95?'#3b7380':v<.3?'#1f4a55':'#235361';});}
function planks(seed:number){
 const n=noiseGrid(seed),r=rng(seed+3),joints=[0,1,2,3].map(()=>Math.floor(r()*16));
 return tile((x,y)=>{const row=Math.floor(y/4),by=y%4;if(by===3)return '#4e3a26';if(x===joints[row])return '#5b442d';const v=n[y*16+x];
  if(by===0)return row%2?'#9c7c52':'#94744b';return v>.9?'#a2825a':v<.08?'#6a5032':row%2?'#866845':'#7e6141';});
}
function plaster(seed:number){
 const n=noiseGrid(seed);return tile((x,y)=>{if(y>=11)return y===11?'#2c221a':y===15?'#3a2c1f':(x%4===0?'#4c3926':'#5f4730');if(y===10)return '#8a7458';const v=n[y*16+x];return v>.9?'#5a6a5c':v<.1?'#3e4b40':'#4a594c';});
}
function shingle(){return tile((x,y)=>{const row=Math.floor(y/4),by=y%4,sx=(x+(row%2?4:0))%8;if(by===3)return '#00000066';if(sx===0&&by<3)return '#00000040';if(by===0)return '#ffffff22';return null;});}
function timber(seed:number){const n=noiseGrid(seed);return tile((x,y)=>{if(x===0||y===15)return '#5e4129';if(x===1)return '#7a5636';if((x+y===15)&&x>1&&x<15&&y>0&&y<15)return '#6b4a30';const v=n[y*16+x];return v>.92?'#d2bb8c':v<.08?'#a88f62':'#bfa676';});}
function carpet(){const n=noiseGrid(77);return tile((x,y)=>{if((x+y)%8===0||(x-y+16)%8===0)return '#9a6a3a';if((x+y)%8===4&&(x-y+16)%8===4)return '#d9b866';const v=n[y*16+x];return v>.9?'#843530':v<.1?'#5e2420':(x+y)%2?'#72302a':'#6c2c27';});}
function cork(seed:number){const n=noiseGrid(seed);return tile((x,y)=>{const v=n[y*16+x];return v>.9?'#a87c50':v>.6?'#946a42':v<.1?'#7a5434':'#8a623e';});}
function parchment(seed:number){const n=noiseGrid(seed);return tile((x,y)=>{const v=n[y*16+x];return v>.94?'#d9c9a0':v<.05?'#bba574':'#e8dbb7';});}
function slate(seed:number){return flagstones(seed,['#4b5a57','#46534f','#50605a'],'#2b3533','#6c7c75');}

/** CSS custom properties injected once at startup; stylesheets refer to them. */
export const textureVars:Record<string,string>={
 '--tx-floor-a':flagstones(11,['#55574a','#5b5d4e','#505244'],'#33352c','#757764'),
 '--tx-floor-b':flagstones(29,['#585a4c','#4f5144','#5d5f50'],'#33352c','#737560'),
 '--tx-wall':bricks(5),
 '--tx-grass-a':grass(3),'--tx-grass-b':grass(9),
 '--tx-road-a':cobbles(4),'--tx-road-b':cobbles(8),
 '--tx-water':water(6),
 '--tx-plank-a':planks(12),'--tx-plank-b':planks(17),
 '--tx-plaster':plaster(2),
 '--tx-carpet':carpet(),'--tx-cork':cork(31),'--tx-parchment':parchment(8),
 '--tx-floor-light':flagstones(41,['#8f8a74','#98927b','#8a846d'],'#6d6855','#aaa48c'),
 '--tx-slate':slate(13),
 '--tx-shingle':shingle(),'--tx-timber':timber(21),
 '--tx-flame':flameStrip,'--tx-coin':dataUrl(pixelSvg(coin,P)),
};
/** Raw data URLs (without url()) for SVG <image href>. */
export const textureHref=(name:string)=>textureVars[name].slice(5,-2).replace(/^"|"$/g,'');

// ---- Title scene: a small harbor at dusk, used behind arrival / onboarding screens --------
function inner(rows:readonly string[],palette:Palette,x:number,y:number,flip=false){return pixelSvg(rows,palette,flip).replace(/^<svg[^>]*>/,`<g transform="translate(${x} ${y})">`).replace('</svg>','</g>');}
function titleScene(){
 const W=192,H=84,r=rng(5);let s='';
 const bands=['#16283a','#1b3142','#223a48','#2b4550','#3a5257','#56605a'];bands.forEach((c,i)=>{s+=`<rect x="0" y="${i*7}" width="${W}" height="7" fill="${c}"/>`;});
 for(let i=0;i<26;i++){const x=Math.floor(r()*W),y=Math.floor(r()*24);s+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${r()>.7?'#fff6b0':'#c9d6dc'}"/>`;}
 for(let y=-6;y<=6;y++)for(let x=-6;x<=6;x++){const d=x*x+y*y;if(d<=36)s+=`<rect x="${158+x}" y="${14+y}" width="1" height="1" fill="${d>28?'#d9c9a0':(x+y>3?'#e8dbb7':'#f4ead0')}"/>`;}
 // far roofs
 const houses=[[4,30,26,'#5a3a2a'],[28,26,22,'#3e4f55'],[48,32,30,'#6a3a2c'],[96,28,24,'#4a4030'],[118,24,28,'#5a3a2a'],[146,30,22,'#3e4f55'],[166,27,26,'#6a3a2c']] as const;
 for(const [x,y,w,roof] of houses){const h=52-y;s+=`<rect x="${x}" y="${y+6}" width="${w}" height="${h-6}" fill="#c2a878"/><rect x="${x}" y="${y+6}" width="1" height="${h-6}" fill="#5e4129"/><rect x="${x+w-1}" y="${y+6}" width="1" height="${h-6}" fill="#5e4129"/>`;
  for(let i=0;i<7;i++)s+=`<rect x="${x-1+Math.floor(i/2)}" y="${y+6-i}" width="${w+2-Math.floor(i/2)*2}" height="1" fill="${i%2?roof:'#00000055'}"/><rect x="${x-1+Math.floor(i/2)}" y="${y+6-i}" width="${w+2-Math.floor(i/2)*2}" height="1" fill="${roof}" opacity=".8"/>`;
  for(let wx=x+4;wx<x+w-5;wx+=9)s+=`<rect x="${wx}" y="${y+11}" width="4" height="4" fill="#ffd27a"/><rect x="${wx}" y="${y+13}" width="4" height="1" fill="#a87c3a"/>`;
  s+=`<rect x="${x+Math.floor(w/2)-2}" y="${48}" width="5" height="4" fill="#4a3020"/>`;}
 // catacomb gate between houses
 s+=`<rect x="80" y="34" width="14" height="18" fill="#5b6560"/><rect x="82" y="40" width="10" height="12" fill="#14181a"/><rect x="83" y="40" width="1" height="12" fill="#8f9279"/><rect x="86" y="40" width="1" height="12" fill="#8f9279"/><rect x="89" y="40" width="1" height="12" fill="#8f9279"/>`;
 // quay
 s+=`<rect x="0" y="52" width="${W}" height="12" fill="#857a61"/><rect x="0" y="52" width="${W}" height="1" fill="#a49778"/>`;
 for(let x=0;x<W;x+=6)for(let y=54;y<63;y+=4)s+=`<rect x="${x+((y/4)%2?3:0)}" y="${y}" width="1" height="3" fill="#6c6452"/>`;
 s+=`<rect x="0" y="63" width="${W}" height="2" fill="#4a4232"/>`;
 // water
 s+=`<rect x="0" y="65" width="${W}" height="${H-65}" fill="#1f4a55"/>`;
 for(let i=0;i<40;i++){const x=Math.floor(r()*W),y=67+Math.floor(r()*16);s+=`<rect x="${x}" y="${y}" width="${3+Math.floor(r()*5)}" height="1" fill="${r()>.5?'#3b7380':'#6aa2ab'}"/>`;}
 for(let y=67;y<H;y+=3)s+=`<rect x="${152+((y*7)%5)}" y="${y}" width="${10-(y-67)/3}" height="1" fill="#e8dbb7" opacity=".55"/>`;
 // characters on the quay
 const keeper:Palette={...pal,y:'#5f84a6',Y:'#3e5c7a',h:'#b9b3a2',H:'#857f70',b:'#e8dcc0'};
 s+=inner(heroSide,pal,60,38)+inner(heroDown,keeper,118,38)+inner(crab,pal,140,42,true)+inner(rat,pal,22,42)+inner(keg,pal,100,38);
 return dataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${s}</svg>`);
}
textureVars['--tx-title']=titleScene();
