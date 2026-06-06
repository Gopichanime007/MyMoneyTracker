const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4173);
const root = process.cwd();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function safePath(urlPath) {
  let cleaned;
  try {
    cleaned = decodeURIComponent((urlPath || '/').split('?')[0]);
  } catch (_err) {
    cleaned = '/';
  }
  const normalized = path.normalize(cleaned).replace(/^([.][.][/\\])+/, '');
  let target = path.join(root, normalized);
  if (cleaned === '/' || cleaned === '') target = path.join(root, 'index.html');
  return target;
}

const server = http.createServer((req, res) => {
  let target = safePath(req.url);

  fs.stat(target, (err, stat) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    if (stat.isDirectory()) {
      target = path.join(target, 'index.html');
    }

    fs.readFile(target, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mime[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}`);
});
