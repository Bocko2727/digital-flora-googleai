#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const ignored=new Set(['.git','node_modules','images']),patterns=[/AIza[0-9A-Za-z_-]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'](?!\$\{)[^"'\s]{12,}["']/i];let hits=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(ignored.has(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(js|ts|json|ya?ml|md|html|txt)$/i.test(e.name)&&e.name!=='.env.example'){const t=fs.readFileSync(f,'utf8');if(patterns.some(p=>p.test(t))){console.error(`ERROR: possible secret in ${f}`);hits++}}}}
walk(process.cwd());console.log(`Secret scan completed with ${hits} finding(s).`);process.exitCode=hits?1:0;
