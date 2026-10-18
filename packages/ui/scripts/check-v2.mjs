import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "tokens/color-and-scale.json"), "utf8"));
const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const rgb = hex => [1,3,5].map(index => linear(parseInt(hex.slice(index,index+2),16)/255));
const lum = hex => rgb(hex).reduce((sum,value,index) => sum+value*[.2126,.7152,.0722][index],0);
const contrast = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const lab = hex => {const [r,g,b]=rgb(hex),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s]};
const checks=[];
const check=(name,pass,measured)=>{checks.push({name,pass,measured});if(!pass)throw Error(name+' '+JSON.stringify(measured))};
for(const [step,token] of Object.entries(source.color.graphite)){const [,a,b]=lab(token.$value);check(`graphite ${step} chroma below .01`,Math.hypot(a,b)<.01,Math.hypot(a,b))}
check('Brand anchor is preserved',source.color.plum['600'].$value==='#6C3CAA',source.color.plum['600'].$value);
for(const theme of ['light','dark']){
  const s=source.semantic[theme],v=key=>s[key].$value;
  for(const fg of ['fg','fg-muted','fg-subtle'])for(const bg of ['bg-canvas','bg-raised','bg-sunken','bg-overlay'])check(`${theme} ${fg}/${bg} readable`,contrast(v(fg),v(bg))>=4.5,contrast(v(fg),v(bg)));
  for(const action of ['primary','brand'])check(`${theme} ${action} action text`,contrast(v('action-'+action+'-bg'),v('action-'+action+'-fg'))>=4.5,contrast(v('action-'+action+'-bg'),v('action-'+action+'-fg')));
  check(`${theme} field boundary`,contrast(v('line-control'),v('bg-raised'))>=3,contrast(v('line-control'),v('bg-raised')));
  check(`${theme} chart palette distinct from status fills`,Array.from({length:8},(_,i)=>v('viz-'+(i+1))).every(color=>!['success-solid','warning-solid','danger-solid','info-solid'].some(key=>v(key)===color)));
}
const dark=source.semantic.dark,background=lab(dark['action-primary-bg'].$value),foreground=lab(dark['action-primary-fg'].$value);
const delta=.18*Math.hypot(...foreground.map((value,index)=>value-background[index]));
check('Dark primary hover has visible OKLab change',delta>.05,delta);
console.log(JSON.stringify({checks:checks.length,all_passed:true,dark_hover_delta:delta},null,2));
