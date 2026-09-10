#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),statuses=new Set(['draft','review','published']),confidence=new Set(['confirmed','high_confidence','probable','genus_only','unidentified']),errors=[],records=[];
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const f=path.join(d,e.name);return e.isDirectory()?walk(f):[f]}):[];
const add=(v,file)=>{if(Array.isArray(v))v.forEach(x=>add(x,file));else if(v&&typeof v==='object'&&('id'in v||'status'in v||'taxonomy'in v))records.push({v,file})};
for(const file of ['data/published','data/drafts'].flatMap(d=>walk(path.join(root,d)).filter(f=>f.endsWith('.json')))){try{add(JSON.parse(fs.readFileSync(file,'utf8')),file)}catch(e){errors.push(`${file}: invalid JSON`)}}
const ids=new Set();
for(const {v,file} of records){const label=`${file}:${v.id||'missing-id'}`,c=v.identification?.confidence??v.confidence,n=v.taxonomy?.scientific_name??v.latin_name,p=v.evidence?.photos??v.photos??v.images??[],s=v.evidence?.sources??v.sources??[];if(!v.id||ids.has(v.id))errors.push(`${label}: missing or duplicate id`);ids.add(v.id);if(!statuses.has(v.status))errors.push(`${label}: invalid status`);if(!confidence.has(c))errors.push(`${label}: invalid confidence`);if(v.status==='published'&&(!n||!p.length||['genus_only','unidentified'].includes(c)))errors.push(`${label}: invalid published record`);const claims=JSON.stringify([v.content?.risks,v.content?.uses,v.risks,v.uses]);if(/toxic|poison|edible|medicinal|лечеб|ядлив|токсич|отров/i.test(claims)&&!s.length)errors.push(`${label}: claim needs source`)}
errors.forEach(e=>console.error(`ERROR: ${e}`));console.log(`Validated ${records.length} record(s).`);process.exitCode=errors.length?1:0;
