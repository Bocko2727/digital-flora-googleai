import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.join(__dirname, 'images', 'review');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'review-results.json'), 'utf8'));
const files = data.items?.map(i => i.file) || [];

console.log(`Checking and downloading ${files.length} images...`);

async function downloadFile(filename) {
  const localDest = path.join(targetDir, filename);
  if (fs.existsSync(localDest) && fs.statSync(localDest).size > 1000) {
    console.log(`[ALREADY EXISTS] ${filename}`);
    return true;
  }

  const urls = [
    `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/review/${filename}`,
    `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/${filename}`,
    `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/herbarium/${filename}`,
    `https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/${filename}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > 500) {
          fs.writeFileSync(localDest, buffer);
          console.log(`[DOWNLOADED] ${filename} from ${url} (${buffer.length} bytes)`);
          return true;
        }
      }
    } catch (e) {
      // Continue to next candidate
    }
  }

  console.warn(`[FAILED TO DOWNLOAD] ${filename}`);
  return false;
}

async function run() {
  let successCount = 0;
  for (const file of files) {
    const ok = await downloadFile(file);
    if (ok) successCount++;
  }
  console.log(`Completed! Downloaded/Verified: ${successCount} / ${files.length}`);
}

run();
