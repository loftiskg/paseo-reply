import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('.', import.meta.url));
const result = await build({ entryPoints: [directory + 'fixture.tsx'], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic' });
const html = await readFile(directory + 'index.html');
const server = createServer((req, res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(result.outputFiles[0].contents); }
  else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});
server.listen(4318, '127.0.0.1', () => console.log('Reply fixture: http://127.0.0.1:4318'));
