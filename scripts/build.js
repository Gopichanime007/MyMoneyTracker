const fs = require('fs');
const path = require('path');

function exists(p) {
  return fs.existsSync(path.join(process.cwd(), p));
}

function main() {
  const required = [
    'index.html',
    'manifest.json',
    'service-worker.js',
    path.join('assets', 'scripts', 'script.js'),
    path.join('assets', 'scripts', 'savings.js'),
    path.join('pages', 'savings.html')
  ];

  const missing = required.filter((p) => !exists(p));
  if (missing.length) {
    console.error('Build validation failed. Missing required files:\n' + missing.join('\n'));
    process.exit(1);
  }

  // Static web app: build step is validation-only.
  console.log('Build validation passed for static web app.');
}

main();
