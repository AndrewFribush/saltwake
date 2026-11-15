/** `?video=1`: recording mode for demo footage. Hides first-run tooltips and developer chrome (footer line).
 * Sets html[data-video] so CSS can hide anything else that reads as scaffolding. */
export const videoMode=(()=>{try{return new URLSearchParams(location.search).get('video')==='1';}catch{return false;}})();
if(videoMode&&typeof document!=='undefined')document.documentElement.dataset.video='1';
