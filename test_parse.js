const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (scriptMatch) {
  const scriptContent = scriptMatch[1];
  try {
    const acorn = require('acorn');
    acorn.parse(scriptContent, { ecmaVersion: 2022, sourceType: 'module' });
    console.log('Parse successful');
  } catch (e) {
    console.error('Parse error:', e);
  }
}
