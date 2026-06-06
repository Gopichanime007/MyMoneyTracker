const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function readBranchFile(branch, filePath) {
  const cmd = `git show ${branch}:${filePath}`;
  return cp.execSync(cmd, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function extractSetArray(source, varName) {
  const marker = `const ${varName} = new Set([`;
  const start = source.indexOf(marker);
  if (start === -1) return [];
  const after = source.slice(start + marker.length);
  const end = after.indexOf(']);');
  if (end === -1) return [];
  const body = after.slice(0, end);
  const out = [];
  const re = /"([^"]+)"|'([^']+)'/g;
  let m;
  while ((m = re.exec(body))) {
    out.push((m[1] || m[2] || '').trim());
  }
  return Array.from(new Set(out));
}

function extractObjectDefaults(source, varName) {
  const marker = `const ${varName} = {`;
  const start = source.indexOf(marker);
  if (start === -1) return {};
  const after = source.slice(start + marker.length);
  const end = after.indexOf('};');
  if (end === -1) return {};
  const body = after.slice(0, end);
  const defaults = {};
  const lineRe = /([A-Za-z0-9_]+)\s*:\s*([^,\n]+)/g;
  let m;
  while ((m = lineRe.exec(body))) {
    defaults[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return defaults;
}

function buildSchema(source) {
  const schema = {
    root: extractSetArray(source, 'rootAllowed'),
    expenses: extractSetArray(source, 'expenseAllowed'),
    savings: extractSetArray(source, 'savingsAllowed'),
    budgets: extractSetArray(source, 'budgetAllowed'),
    budgetPeriods: extractSetArray(source, 'periodAllowed'),
    settings: extractSetArray(source, 'settingsAllowed'),
    meta: extractSetArray(source, 'metaAllowed'),
    quotations: ['quotationData', 'quotationItems', 'quotationCharges'],
    settingsDefaults: extractObjectDefaults(source, 'IMPORT_DEFAULT_SETTINGS')
  };

  // Legacy main branch does not contain explicit allowlists, so we fallback
  // to a conservative schema inferred from legacy storage/read paths.
  if (!schema.root.length && !schema.expenses.length && !schema.budgets.length && !schema.savings.length) {
    schema.root = [
      'expenses',
      'budgets',
      'savings',
      'budgetPeriods',
      'categories',
      'persons',
      'settings',
      'orders',
      'quotations',
      'meta'
    ];

    schema.expenses = [
      'id', 'type', 'amount', 'category', 'purpose', 'note', 'budgetId', 'paymentType', 'date', 'sourceId', 'allocationTrail'
    ];
    schema.budgets = [
      'id', 'budgetId', 'type', 'totalAllocated', 'entity', 'date', 'periodKey', 'monthKey'
    ];
    schema.savings = [
      'id', 'type', 'amount', 'sourceId', 'paymentType', 'note', 'purpose', 'date', 'person', 'linkedTransactionId'
    ];
    schema.budgetPeriods = ['id', 'start', 'end', 'status', 'extraDays', 'periodKey'];
    schema.settings = ['theme', 'currencyCode', 'autoBackup', 'backupFrequency'];
    schema.meta = ['version', 'exportedAt'];
    schema.settingsDefaults = { theme: '', currencyCode: 'INR' };
  }

  return schema;
}

function diffEntity(mainFields, devFields) {
  const m = new Set(mainFields);
  const d = new Set(devFields);
  const added = [...d].filter((x) => !m.has(x));
  const removed = [...m].filter((x) => !d.has(x));
  return { added, removed };
}

function detectRenames(mainFields, devFields) {
  const removed = new Set(mainFields.filter((x) => !devFields.includes(x)));
  const added = new Set(devFields.filter((x) => !mainFields.includes(x)));
  const pairs = [
    ['personId', 'linkedPersonId'],
    ['budgetId', 'linkedBudgetId'],
    ['payment', 'paymentType']
  ];
  return pairs
    .filter(([from, to]) => removed.has(from) && added.has(to))
    .map(([from, to]) => ({ from, to }));
}

function main() {
  const file = 'assets/scripts/script.js';
  const mainSrc = readBranchFile('main', file);
  const devSrc = fs.readFileSync(path.join(repoRoot, file), 'utf8');

  const mainSchema = buildSchema(mainSrc);
  const devSchema = buildSchema(devSrc);

  const entities = ['expenses', 'budgets', 'savings', 'budgetPeriods', 'settings', 'quotations', 'meta'];
  const diffs = {};
  entities.forEach((entity) => {
    diffs[entity] = diffEntity(mainSchema[entity], devSchema[entity]);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    source: { main: 'main:assets/scripts/script.js', development: 'development:assets/scripts/script.js' },
    entities,
    mainSchema,
    developmentSchema: devSchema,
    diffs,
    rootDiff: diffEntity(mainSchema.root, devSchema.root),
    renameCandidates: {
      expenses: detectRenames(mainSchema.expenses, devSchema.expenses),
      savings: detectRenames(mainSchema.savings, devSchema.savings),
      budgets: detectRenames(mainSchema.budgets, devSchema.budgets)
    }
  };

  const outDir = path.join(repoRoot, 'scripts', 'generated');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'schema-compatibility-report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Schema Compatibility Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Schema Comparison Matrix');
  lines.push('');
  lines.push('| Entity | Field | Main | Development | Compatibility Status |');
  lines.push('|---|---|---|---|---|');

  for (const entity of entities) {
    const mainFields = new Set(mainSchema[entity]);
    const devFields = new Set(devSchema[entity]);
    const all = Array.from(new Set([...mainFields, ...devFields])).sort();
    for (const field of all) {
      const inMain = mainFields.has(field) ? 'Yes' : 'No';
      const inDev = devFields.has(field) ? 'Yes' : 'No';
      const status = inMain && inDev ? 'Compatible' : (inMain ? 'Removed in Development' : 'Added in Development');
      lines.push(`| ${entity} | ${field} | ${inMain} | ${inDev} | ${status} |`);
    }
  }

  lines.push('');
  lines.push('## Detected Differences');
  lines.push('');
  for (const entity of entities) {
    const diff = diffs[entity];
    lines.push(`### ${entity}`);
    lines.push(`- New Fields: ${diff.added.length ? diff.added.join(', ') : 'None'}`);
    lines.push(`- Removed Fields: ${diff.removed.length ? diff.removed.join(', ') : 'None'}`);
  }

  lines.push('');
  lines.push('## Rename Candidates');
  lines.push('');
  Object.keys(report.renameCandidates).forEach((entity) => {
    const list = report.renameCandidates[entity];
    lines.push(`- ${entity}: ${list.length ? list.map((x) => `${x.from} -> ${x.to}`).join(', ') : 'None'}`);
  });

  fs.writeFileSync(path.join(repoRoot, 'SCHEMA_COMPATIBILITY_REPORT.md'), lines.join('\n'));
  console.log('Generated scripts/generated/schema-compatibility-report.json and SCHEMA_COMPATIBILITY_REPORT.md');
}

main();
