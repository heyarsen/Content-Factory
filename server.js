import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import proxy from './api/proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use('/api/proxy', proxy);

const distPath = path.join(__dirname, 'dist');

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date().toISOString() });
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '1d' }));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('*', (req, res) => res.send('Build pending...'));
}

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
