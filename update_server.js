import fs from 'fs';

let serverJs = fs.readFileSync('server.js', 'utf8');

// Remove multer and fs usage for review-results
serverJs = serverJs.replace("import multer from 'multer';", "");

const multerConfig = `// Configure Multer for uploads
const uploadDir = path.join(__dirname, 'images', 'review');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, res, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\\s+/g, '_'))
});
const upload = multer({ storage });`;

serverJs = serverJs.replace(multerConfig, "");
serverJs = serverJs.replace(/const upload = multer\(\{ storage \}\);/, "");

// Replace the upload API
const oldUploadAPI = `// Upload API
app.post('/api/upload', upload.single('plantImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Няма качен файл.' });
  }
  try {
    const base64Image = fs.readFileSync(req.file.path).toString('base64');
    const mimeType = req.file.mimetype;`;

const newUploadAPI = `app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({limit: '10mb', extended: true}));

// Upload API
app.post('/api/upload', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Няма качена снимка.' });
  }
  try {
    // Extract base64 content
    const match = image.match(/^data:(image\\/\\w+);base64,(.*)$/);
    if (!match) {
      return res.status(400).json({ error: 'Невалиден файлов формат.' });
    }
    const mimeType = match[1];
    const base64Image = match[2];`;

serverJs = serverJs.replace(oldUploadAPI, newUploadAPI);

// Remove the json saving
const jsonSaving = `    aiData.file_name = req.file.filename;
    aiData.analyzed_at = new Date().toISOString();

    // Append to review-results.json
    const dataPath = path.join(__dirname, 'data', 'review-results.json');
    let allData = [];
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      try {
        allData = JSON.parse(fileContent);
      } catch (e) {
        console.error("Invalid JSON in review-results.json", e);
      }
    }
    
    if (Array.isArray(allData)) {
      allData.unshift(aiData); // Add to top
    } else if (allData.items) {
      allData.items.unshift(aiData);
    } else {
      allData = [aiData];
    }
    
    fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));`;

const newJsonSaving = `    aiData.analyzed_at = new Date().toISOString();`;

serverJs = serverJs.replace(jsonSaving, newJsonSaving);

fs.writeFileSync('server.js', serverJs);
console.log('Server modified');
