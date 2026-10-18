// Shared blank content for seed imports and template-free creation. The group shapes match
// Website Manager's caseStudySchema; arrays describe no invented projects or results.
const DEPARTMENTS = ['design', 'development', 'hosting', 'digital-marketing', 'it-support'];
const section = (fields) => ({title: [], intro: '', ...fields});
function caseWords(department) {
  const common = {name:'', category:'', sector:'', summary:'', transformation:'', client:'', timeline:'', team:'', challenge:'', goal:'', role:'', highlight:{value:'',label:''}};
  const blocks = {
    design: {approach:section({steps:[]}), delivered:section({palette:[],typeface:'',weights:[],touchpoints:[]}), results:section({metrics:[],shifts:[]})},
    development: {approach:section({steps:[]}), delivered:section({core:'',layers:[],modules:[],stack:[]}), results:section({gauges:[],metrics:[]})},
    hosting: {approach:section({steps:[]}), delivered:section({components:[]}), results:section({chart:{label:'',cutover:0,points:[]},metrics:[]})},
    'digital-marketing': {approach:section({weeks:1,steps:[]}), delivered:section({week:[]}), results:section({kpis:[],monthly:{label:'',baseline:0,points:[]},funnel:[],channels:[]})},
    'it-support': {approach:section({steps:[]}), delivered:section({priorities:[]}), results:section({comparisons:[]})}
  };
  if (!blocks[department]) throw new Error('Unknown case-study department');
  return {...common,...blocks[department]};
}
function blankContent(type, department, at = new Date().toISOString()) {
  const base = {slug:{en:''},locales:{en:{}},seo:{en:{title:'',description:'',robots:'noindex',inSitemap:true}}};
  if (type === 'caseStudy') return {...base,narrativePublished:false,sampleNarrativePublished:false,provenance:{figures:'sample',sampleLabel:{en:'Sample figures'}},image:{src:'',alt:{}},gallery:[],locales:{en:caseWords(department)}};
  if (type === 'article') return {...base,category:'design',publishedOn:at.slice(0,10),readingMinutes:1,image:{src:'',alt:{}},locales:{en:{name:'',excerpt:'',takeaways:[],sections:[]}}};
  if (type === 'roadmapItem') return {...base,slug:{},seo:{},status:'open',period:'next',year:at.slice(0,4),progress:0,locales:{en:{name:'',body:'',timing:'',theme:''}}};
  if (type === 'review') return {...base,slug:{},seo:{},sample:true,relatedEntry:'',position:0,image:{src:'',alt:{}},locales:{en:{name:'',role:'',company:'',quote:''}}};
  throw new Error('Unsupported blank content type');
}
module.exports = {DEPARTMENTS,caseWords,blankContent};
