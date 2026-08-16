import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

const oldUpload = `window.uploadPlant = async function uploadPlant(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById('uploadStatus');
  status.style.display = 'block';
  status.innerText = '⏳ AI ботаникът анализира снимката...';
  
  const formData = new FormData();
  formData.append('plantImage', file);
  
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    status.style.display = 'none';
    
    const record = result.record;
    const image = 'images/review/' + record.file_name;`;

const newUpload = `window.uploadPlant = async function uploadPlant(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById('uploadStatus');
  status.style.display = 'block';
  status.innerText = '⏳ AI ботаникът анализира снимката...';
  
  try {
    const base64String = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_size = 800;
          
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64String })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Грешка при анализа');
    }
    
    const result = await res.json();
    status.style.display = 'none';
    
    const record = result.record;
    const image = result.base64;`;

html = html.replace(oldUpload, newUpload);

fs.writeFileSync('index.html', html);
console.log('Index modified');
