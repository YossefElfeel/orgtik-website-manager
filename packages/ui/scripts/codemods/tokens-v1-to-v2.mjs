import fs from 'node:fs';
import path from 'node:path';
const directory=path.resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Pass an explicitly owned app directory.');
const write=process.argv.includes('--write'),changes=[];
const aliases={'--shadow-lit':'--ot-shadow-lit','--shadow-overlay':'--ot-shadow-overlay','--radius-card':'--ot-radius-card','--radius-panel':'--ot-radius-panel','--shadow-contact':'--ot-shadow-contact'};
function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(['node_modules','.next','.next-demo','.git'].includes(entry.name))continue;const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else if(/\.(css|tsx?|jsx?)$/.test(entry.name)){const original=fs.readFileSync(file,'utf8');let source=original;for(const[oldToken,newToken]of Object.entries(aliases))source=source.replaceAll(`var(${oldToken})`,`var(${newToken})`);if(source!==original){changes.push(path.relative(directory,file));if(write)fs.writeFileSync(file,source)}}}}
walk(directory);console.log(JSON.stringify({mode:write?'write':'review',changes},null,2));
