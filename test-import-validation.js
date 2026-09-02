const fs = require('fs');

const filePath = 'assets/scripts/Sample.json';

console.log('========================================');
console.log(' MyMoneyTracker Import Validation Test');
console.log('========================================');
console.log();

if (!fs.existsSync(filePath)) {
    console.error('ERROR: Test file not found:', filePath);
    process.exit(1);
}

const text = fs.readFileSync(filePath, 'utf8');

console.log('File:', filePath);
console.log('Size:', text.length, 'characters');
console.log();

let data;

try {
    data = JSON.parse(text);
} catch (error) {
    console.error('❌ JSON PARSE FAILED');
    console.error('Error:', error.message);
    process.exit(1);
}

console.log('✅ JSON PARSE PASSED');
console.log();

const errors = [];
const warnings = [];

//
// Version
//

const version =
    data?.meta?.version || null;

console.log('Version:', version || 'MISSING');

if (!version) {
    errors.push('Missing meta.version');
}

if (version && version !== '2.0.0') {
    errors.push(
        `Unsupported version: ${version}`
    );
}

//
// Expected arrays
//

const expectedArrays = [
    'expenses',
    'budgets',
    'savings',
    'budgetPeriods',
    'categories',
    'persons',
    'orders'
];

console.log();
console.log('Record Counts');
console.log('-------------');

for (const key of expectedArrays) {

    if (!Array.isArray(data[key])) {

        warnings.push(
            `${key} is missing or is not an array`
        );

        console.log(
            `${key}: NOT ARRAY`
        );

        continue;
    }

    console.log(
        `${key}: ${data[key].length}`
    );
}

//
// Unassigned Topups
//

console.log();

if (Array.isArray(data.unassignedTopups)) {

    console.log(
        `unassignedTopups: ${data.unassignedTopups.length}`
    );

} else {

    console.log(
        'unassignedTopups: NOT ARRAY'
    );

    warnings.push(
        'unassignedTopups is missing or is not an array'
    );
}

//
// Quotations
//

console.log();
console.log('Quotations');
console.log('----------');

if (
    data.quotations &&
    typeof data.quotations === 'object'
) {

    console.log('Present: YES');

    console.log(
        'Keys:',
        Object.keys(data.quotations)
    );

} else {

    console.log('Present: NO');

    warnings.push(
        'Quotations section is missing'
    );
}

//
// Settings
//

console.log();
console.log('Settings');
console.log('--------');

if (
    data.settings &&
    typeof data.settings === 'object'
) {

    console.log('Present: YES');

    console.log(
        'Keys:',
        Object.keys(data.settings)
    );

} else {

    console.log('Present: NO');

    warnings.push(
        'Settings section is missing'
    );
}

//
// Top-level keys
//

console.log();
console.log('Top-Level Keys');
console.log('--------------');

console.log(
    Object.keys(data)
);

//
// Summary
//

console.log();
console.log('========================================');
console.log(' Validation Summary');
console.log('========================================');
console.log();

if (warnings.length) {

    console.log(
        `⚠️ Warnings: ${warnings.length}`
    );

    warnings.forEach(
        warning => {
            console.log(
                '  -',
                warning
            );
        }
    );

} else {

    console.log(
        'Warnings: 0'
    );
}

console.log();

if (errors.length) {

    console.log(
        `❌ Errors: ${errors.length}`
    );

    errors.forEach(
        error => {
            console.log(
                '  -',
                error
            );
        }
    );

    console.log();
    console.log(
        '❌ VALIDATION FAILED'
    );

    process.exit(1);

} else {

    console.log(
        'Errors: 0'
    );

    console.log();
    console.log(
        '✅ VALIDATION PASSED'
    );
}

console.log();
console.log(
    'No application data was modified.'
);
