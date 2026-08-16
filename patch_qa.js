import fs from 'fs';

// 1. Patch server.js
let serverCode = fs.readFileSync('server.js', 'utf8');
if (!serverCode.includes('app.use(express.json())')) {
  serverCode = serverCode.replace('app.use(express.static(__dirname));', 'app.use(express.json());\napp.use(express.static(__dirname));');
}

if (!serverCode.includes('/api/qa')) {
  const qaRoute = `
// QA API
app.post('/api/qa', async (req, res) => {
  const { filename, claimedName, latinName } = req.body;
  if (!filename) return res.status(400).json({error: 'Липсва файл'});

  let base64 = null;
  let mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const cleanFilename = path.basename(filename);

  const localPaths = [
    path.join(__dirname, cleanFilename),
    path.join(__dirname, 'images', 'review', cleanFilename),
    path.join(__dirname, 'images', 'herbarium', cleanFilename),
    path.join(__dirname, 'images', 'uploads', cleanFilename)
  ];
  
  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      base64 = fs.readFileSync(p).toString('base64');
      break;
    }
  }
  
  if (!base64) {
    const githubPaths = [
      \`https://raw.githubusercontent.com/Bocko2727/digitalflora/main/\${cleanFilename}\`,
      \`https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/review/\${cleanFilename}\`,
      \`https://raw.githubusercontent.com/Bocko2727/digitalflora/main/images/herbarium/\${cleanFilename}\`
    ];
    for (const url of githubPaths) {
      try {
        const fetchRes = await fetch(url);
        if (fetchRes.ok) {
          const arrayBuffer = await fetchRes.arrayBuffer();
          base64 = Buffer.from(arrayBuffer).toString('base64');
          break;
        }
      } catch (e) {}
    }
  }

  if (!base64) return res.status(404).json({error: 'Снимката не е намерена'});

  const prompt = \`You are an expert botanist performing Quality Assurance.
Look at this image.
Is this plant really "\${claimedName}" (\${latinName})?
Answer YES or NO (strictly start your verdict with YES or NO), and provide a short 1-2 sentence explanation in Bulgarian.\`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        { role: 'user', parts: [
          { inlineData: { data: base64, mimeType } },
          { text: prompt }
        ]}
      ]
    });
    res.json({ verdict: response.text.trim() });
  } catch (error) {
    console.error('QA Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload API`;
  serverCode = serverCode.replace('// Upload API', qaRoute);
  fs.writeFileSync('server.js', serverCode);
}

// 2. Patch index.html
let html = fs.readFileSync('index.html', 'utf8');

const targetDraw = '<div class="sources"><b>Източници:</b> ${src}</div></div></article>`}';
const qaHtml = `<div class="sources"><b>Източници:</b> \${src}</div>
  <div style="margin-top:20px; padding:15px; background:#e6f0fa; border-left:4px solid #3b82f6; border-radius:7px;">
    <h3 style="margin:0 0 5px 0; color:#1e3a8a; font-size:16px;">🔍 Интерактивен QA Контрол</h3>
    <p style="font-size:13px; margin:0 0 10px 0; color:#475569;">Провери дали тази снимка наистина отговаря на името.</p>
    <button onclick="runQA()" style="background:#3b82f6; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:13px;">Извърши AI проверка</button>
    <div id="qa-result" style="margin-top:10px; font-weight:600; font-size:14px; white-space:pre-wrap;"></div>
  </div>
</div></article>\`}`;

if (!html.includes('Интерактивен QA Контрол')) {
  html = html.replace(targetDraw, qaHtml);
}

const targetScript = 'menu();draw();</script>';
const qaScript = `
async function runQA() {
  const p = P[n];
  const filename = p[3][photo].split('/').pop();
  const claimedName = p[0];
  const latinName = p[1];
  
  const resDiv = document.getElementById('qa-result');
  resDiv.innerHTML = '⏳ AI ботаникът анализира... Моля, изчакайте.';
  resDiv.style.color = '#d97706';
  
  try {
    const res = await fetch('/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, claimedName, latinName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Грешка при проверката');
    
    const v = data.verdict;
    if (v.startsWith('YES') || v.startsWith('ДА') || v.includes('YES')) {
      resDiv.style.color = '#15803d'; // green
    } else {
      resDiv.style.color = '#b91c1c'; // red
    }
    resDiv.innerText = v;
  } catch (err) {
    resDiv.style.color = '#b91c1c';
    resDiv.innerText = '❌ ' + err.message;
  }
}
menu();draw();</script>`;

if (!html.includes('function runQA()')) {
  html = html.replace(targetScript, qaScript);
}

fs.writeFileSync('index.html', html);
console.log('QA patched successfully');
