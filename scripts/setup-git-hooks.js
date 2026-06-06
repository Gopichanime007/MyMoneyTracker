const { execSync } = require('child_process');

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

try {
  run('git config core.hooksPath .githooks');
  console.log('Configured git hooks path: .githooks');
} catch (error) {
  console.error('Failed to configure git hooks path.');
  process.exit(1);
}
