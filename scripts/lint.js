const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function validateJson(file) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    return null;
  } catch (err) {
    return `Invalid JSON: ${file} -> ${err.message}`;
  }
}

function validateJs(file) {
  try {
    // Parse check only; does not execute app code.
    // eslint-disable-next-line no-new, no-new-func
    new Function(fs.readFileSync(file, 'utf8'));
    return null;
  } catch (err) {
    return `Invalid JS syntax: ${file} -> ${err.message}`;
  }
}

function main() {
  const root = process.cwd();
  const files = walk(root);

  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.includes(`${path.sep}coverage${path.sep}`));

  const errors = [];

  for (const file of jsFiles) {
    const err = validateJs(file);
    if (err) errors.push(err);
  }

  for (const file of jsonFiles) {
    const err = validateJson(file);
    if (err) errors.push(err);
  }

  if (errors.length) {
    console.error('Lint checks failed:\n' + errors.join('\n'));
    process.exit(1);
  }

  console.log(`Lint checks passed. JS files: ${jsFiles.length}, JSON files: ${jsonFiles.length}`);
}

main();
