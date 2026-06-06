# Money Tracker Git Branch Strategy and Release Flow

## Branch Architecture

### main (Production)
- Production-ready code only.
- Fully tested and validated code only.
- No experimental or partial feature work.
- Direct commits prohibited.
- Direct pushes prohibited.
- Merge source allowed: development only.

### development (Integration)
- UAT-ready integration branch.
- Contains completed and integrated features.
- Must pass lint, tests, build, and financial validation before promoting to main.

### feature/* (Work in Progress)
- Feature implementation and experimentation.
- Incomplete work allowed.
- Merge target: development.
- Never merge directly into main.

## Setup

1. Create development branch from main
- git checkout main
- git pull origin main
- git checkout -b development
- git push -u origin development

2. Configure local git hooks
- npm run hooks:install

## Feature Flow

1. Start feature branch from development
- git checkout development
- git checkout -b feature/budget-efficiency
- git push -u origin feature/budget-efficiency

2. Develop iteratively
- git add .
- git commit -m "Implement budget efficiency calculations"
- git push

3. Feature completion gate
- npm run lint
- npm test -- --coverage
- npm run build

4. Merge feature to development
- git checkout development
- git pull origin development
- git merge feature/budget-efficiency
- git push origin development

## Development Validation Gate

After any merge into development, run:
- npm run lint
- npm test -- --coverage
- npm run build

Manual verification scope:
- Financial workflow testing
- Budget testing
- Savings testing
- Refund testing
- Transfer Back testing
- Attachment testing
- History testing

## Promotion to main

Only after all validation passes:
- git checkout main
- git pull origin main
- git merge development
- git push origin main

## Production Release Checklist

### Technical
- Build passes
- Lint passes
- Tests pass
- No console errors

### Financial Integrity
- Running balance verified
- Refund logic verified
- Partial refund verified
- Move to budget verified
- Transfer back verified
- Savings balances verified
- Budget balances verified

### UI
- Attachment lifecycle verified
- History rendering verified
- Graph calculations verified
- Budget efficiency verified
- Dashboard totals verified

## Release Gate Command

- npm run release:gate

This command runs lint, test with coverage, and build, then prints:
- Coverage %
- Critical issues
- High issues
- Medium issues
- Low issues
- READY FOR PRODUCTION or NOT READY FOR PRODUCTION

Note: Do not merge development to main until release readiness is explicitly verified.
