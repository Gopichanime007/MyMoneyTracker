const { execSync } = require('child_process');
const fs = require('fs');

function run(label, command) {
  try {
    execSync(command, { stdio: 'inherit' });
    return { label, ok: true };
  } catch (error) {
    return { label, ok: false };
  }
}

const checks = [];
checks.push(run('lint', 'npm run lint'));
checks.push(run('tests', 'npm test -- --coverage --coverageReporters=text --coverageReporters=json-summary'));
checks.push(run('build', 'npm run build'));

let coveragePct = 0;
try {
  const summaryPath = 'coverage/coverage-summary.json';
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    coveragePct = Number(summary.total.lines.pct || 0);
  }
} catch (error) {
  coveragePct = 0;
}

const failedChecks = checks.filter(c => !c.ok).length;
const criticalIssues = failedChecks;
const highIssues = 0;
const mediumIssues = coveragePct < 60 ? 1 : 0;
const lowIssues = 0;

console.log('--- Release Gate Summary ---');
console.log(`Coverage % (lines): ${coveragePct.toFixed(2)}`);
console.log(`Critical Issues: ${criticalIssues}`);
console.log(`High Issues: ${highIssues}`);
console.log(`Medium Issues: ${mediumIssues}`);
console.log(`Low Issues: ${lowIssues}`);

const ready = criticalIssues === 0 && highIssues === 0 && mediumIssues === 0;
console.log(ready ? 'READY FOR PRODUCTION' : 'NOT READY FOR PRODUCTION');

if (!ready) {
  process.exit(1);
}
