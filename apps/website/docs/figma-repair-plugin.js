// Runs inside use_figma. CONFIG is supplied by the orchestration call.
const round = v => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
function paints(v) {
  if (!Array.isArray(v)) return null;
  return v.map(p => ({ type:p.type, color:p.color, opacity:p.opacity, gradientStops:p.gradientStops, gradientTransform:p.gradientTransform, scaleMode:p.scaleMode, visible:p.visible }));
}
function hash(s) { let h=2166136261; for(let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619); return (h>>>0).toString(36); }
const cache = new Map();
function signature(n, root=true) {
  const key=n.id+root;
  if(cache.has(key)) return cache.get(key);
  const obj={ type:['FRAME','COMPONENT','INSTANCE'].includes(n.type)?'BOX':n.type, w:round(n.width),h:round(n.height),visible:n.visible,opacity:round(n.opacity),rotation:round(n.rotation) };
  if(!root){obj.x=round(n.x);obj.y=round(n.y);}
  for(const k of ['layoutMode','layoutPositioning','paddingLeft','paddingRight','paddingTop','paddingBottom','itemSpacing','counterAxisSpacing','primaryAxisAlignItems','counterAxisAlignItems','cornerRadius','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius','strokeWeight','clipsContent']) {
    if(k in n && typeof n[k]!=='symbol') obj[k]=round(n[k]);
  }
  for(const k of ['fills','strokes']) if(k in n) obj[k]=paints(n[k]);
  if(n.type==='TEXT') for(const k of ['fontName','fontSize','lineHeight','letterSpacing','textAlignHorizontal','textAlignVertical','textAutoResize']) if(typeof n[k]!=='symbol')obj[k]=n[k];
  if('children'in n)obj.children=n.children.map(c=>signature(c,false));
  const s=hash(JSON.stringify(obj));cache.set(key,s);return s;
}
const page=await figma.getNodeByIdAsync(CONFIG.pageId);
await figma.setCurrentPageAsync(page);
if(CONFIG.mode==='library') {
  return {components:page.findAllWithCriteria({types:['COMPONENT']}).map(n=>({id:n.id,name:n.name,owner:n.parent.type==='COMPONENT_SET'?n.parent.name:n.name,signature:signature(n),w:n.width,h:n.height,descendants:n.findAll(()=>true).length})),styles:(await figma.getLocalTextStylesAsync()).map(s=>({id:s.id,name:s.name,font:s.fontName,size:s.fontSize,line:s.lineHeight,letter:s.letterSpacing})),collections:(await figma.variables.getLocalVariableCollectionsAsync()).map(c=>({id:c.id,name:c.name,modes:c.modes})),variables:(await figma.variables.getLocalVariablesAsync()).map(v=>({id:v.id,name:v.name,collection:v.variableCollectionId,type:v.resolvedType,values:v.valuesByMode,scopes:v.scopes,syntax:v.codeSyntax}))};
}
const assets=CONFIG.components||[];
const bySig=new Map(assets.map(a=>[a.signature,a]));
const nodes=page.findAllWithCriteria({types:['FRAME']}).filter(n=>n.visible && !n.findAncestor(p=>p.type==='INSTANCE'||p.type==='COMPONENT'));
const matches=nodes.map(n=>({n,a:bySig.get(signature(n))})).filter(v=>v.a&&v.a.descendants>1);
if(CONFIG.mode==='inspect')return {page:page.id,matchCount:matches.length,matches:matches.map(({n,a})=>({id:n.id,name:n.name,w:n.width,h:n.height,component:a.id,owner:a.owner})),frameCount:nodes.length};
