// Scoped import migration for the two remaining kits. Review diagnostics before deleting a kit.
import fs from 'node:fs';
import path from 'node:path';
const directory=path.resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Pass an explicitly owned app directory.');
const mappings={button:['Button','buttonVariants'],input:['Input'],textarea:['Textarea'],badge:['Badge','badgeVariants'],checkbox:['Checkbox'],switch:['Switch'],separator:['Separator'],skeleton:['Skeleton'],progress:['Progress']};
const write=process.argv.includes('--write'),changes=[];
function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(['node_modules','.next','.next-demo','.git'].includes(entry.name))continue;const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else if(/\.(tsx?|jsx?)$/.test(entry.name)){const original=fs.readFileSync(file,'utf8');let source=original;for(const[component,exports]of Object.entries(mappings)){const expression=new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*["']@/components/ui/${component}["'];?`,'g');source=source.replace(expression,(match,names)=>names.split(',').every(name=>exports.includes(name.trim().split(/\s+as\s+/)[0]))?`import {${names}} from "@orgtik/ui";`:match)}if(source!==original){changes.push(path.relative(directory,file));if(write)fs.writeFileSync(file,source)}}}}
walk(directory);console.log(JSON.stringify({mode:write?'write':'review',changes},null,2));
