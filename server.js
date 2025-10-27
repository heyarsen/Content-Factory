import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Add logging
console.log('Starting server...');
console.log('PORT from env:', process.env.PORT);
console.log('Using PORT:', PORT);

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server successfully running on http://0.0.0.0:${PORT}`);
  console.log(`Ready to accept connections`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});
