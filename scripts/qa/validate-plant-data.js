#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const allowedStatus = new Set(['draft', 'review', 'published']);
const allowedConfidence = new Set(['confirmed', 'high_confidence', 'probable', 'genus_only', 'unidentified']);
const imageExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const records = [];
const errors = [];
const warnings = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${path.relative(root, file)}: invalid JSON (${error.message})`); return null; }
}
function collect(value, file) {
  if (Array.isArray(value)) return value.forEach((item) => collect(item, file));
  if (value && typeof value === 'object' && ('id' in value || 'status' in value || 'taxonomy' in value)) records.push({ record: value, file });
}
function field(record, nested, legacy) {
  const value = nested.reduce((node, key) => node && node[key], record);
  return value ?? record[legacy];
}
function textClaims(value) {
  return Array.isArray(value) ? value.map(String).join(' ') : typeof value === 'string' ? value : JSON.stringify(value || '');
}
function validate({ record, file }) {
  const label = `${path.relative(root, file)}:${record.id || 'missing-id'}`;
  const status = record.status;
  const confidence = field(record, ['identification', 'confidence'], 'confidence');
  const scientificName = field(record, ['taxonomy', 'scientific_name'], 'latin_name');
  const photos = field(record, ['evidence', 'photos'], 'photos') || record.images || [];
  const sources = field(record, ['evidence', 'sources'], 'sources') || record.sources || [];
  const risks = field(record, ['content', 'risks'], 'risks') || {};
  const uses = field(record, ['content', 'uses'], 'uses') || record.uses || [];
  if (!record.id || typeof record.id !== 'string') errors.push(`${label}: missing string id`);
  if (!allowedStatus.has(status)) errors.push(`${label}: invalid status '${status}'`);
  if (!allowedConfidence.has(confidence)) errors.push(`${label}: invalid confidence '${confidence}'`);
  if (status === 'published' && (!scientificName || typeof scientificName !== 'string')) errors.push(`${label}: published record requires scientific_name`);
  if (status === 'published' && (!Array.isArray(photos) || photos.length === 0)) errors.push(`${label}: published record requires at least one photo`);
  if (status === 'published' && ['genus_only', 'unidentified'].includes(confidence)) errors.push(`${label}: ${confidence} record cannot be published`);
  for (const photo of photos) {
    const reference = typeof photo === 'string' ? photo : photo.path || photo.src || photo.id;
    if (!reference) { errors.push(`${label}: photo has no path or id`); continue; }
    if (typeof reference === 'string' && !reference.startsWith('http')) {
      const local = path.resolve(root, reference.replace(/^\//, ''));
      if (imageExt.has(path.extname(local).toLowerCase()) && !fs.existsSync(local)) errors.push(`${label}: missing image ${reference}`);
    }
  }
  const safetyText = textClaims(risks) + ' ' + textClaims(uses);
  if (/(toxic|toxicity|poison|edible|medicinal|лечеб|ядлив|токсич|отров)/i.test(safetyText) && (!Array.isArray(sources) || sources.length === 0)) errors.push(`${label}: safety, edible or medicinal claim requires a source`);
  if (status === 'published' && (!Array.isArray(sources) || sources.length === 0)) warnings.push(`${label}: published record has no sources`);
}
const directories = ['data/published', 'data/drafts'];
const files = directories.flatMap((dir) => walk(path.join(root, dir)).filter((file) => file.endsWith('.json')));
for (const file of files) collect(readJson(file), file);
for (const entry of records) validate(entry);
const ids = new Map();
for (const { record, file } of records) {
  if (!record.id) continue;
  if (ids.has(record.id)) errors.push(`duplicate plant id '${record.id}' in ${path.relative(root, file)} and ${path.relative(root, ids.get(record.id))}`);
  else ids.set(record.id, file);
}
for (const message of warnings) console.warn(`WARNING: ${message}`);
for (const message of errors) console.error(`ERROR: ${message}`);
console.log(`Validated ${records.length} canonical plant record(s) in ${files.length} JSON file(s).`);
process.exitCode = errors.length ? 1 : 0;
