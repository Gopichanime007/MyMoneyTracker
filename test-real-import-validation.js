const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync(
    'assets/scripts/script.js',
    'utf8'
);

const testFile =
    'assets/scripts/Sample.json';

const payload =
    fs.readFileSync(
        testFile,
        'utf8'
    );


/*
 * ---------------------------------------------------------
 * FIND THE VALIDATION BLOCK
 * ---------------------------------------------------------
 */

const startMarker =
    'function normalizeImportRawText(rawText) {';

const endMarker =
    'function validateImportPayload(parsed) {';


const start =
    source.indexOf(
        startMarker
    );

const end =
    source.indexOf(
        endMarker
    );


if (start === -1) {

    console.error(
        '❌ Could not find validation block start.'
    );

    process.exit(1);
}


if (end === -1) {

    console.error(
        '❌ Could not find validation block end.'
    );

    process.exit(1);
}


/*
 * We need the complete validateImportPayload()
 * function, so find its closing brace.
 */

function findFunctionEnd(
    text,
    functionStart
) {

    const braceStart =
        text.indexOf(
            '{',
            functionStart
        );

    if (braceStart === -1) {

        throw new Error(
            'Could not find function opening brace.'
        );
    }


    let depth = 0;

    let string = null;

    let escaped = false;

    let lineComment = false;

    let blockComment = false;


    for (
        let i = braceStart;
        i < text.length;
        i++
    ) {

        const char =
            text[i];

        const next =
            text[i + 1];


        /*
         * Line comment
         */

        if (lineComment) {

            if (
                char === '\n' ||
                char === '\r'
            ) {
                lineComment = false;
            }

            continue;
        }


        /*
         * Block comment
         */

        if (blockComment) {

            if (
                char === '*' &&
                next === '/'
            ) {

                blockComment = false;

                i++;
            }

            continue;
        }


        /*
         * String
         */

        if (string) {

            if (escaped) {

                escaped = false;

                continue;
            }


            if (char === '\\') {

                escaped = true;

                continue;
            }


            if (char === string) {

                string = null;
            }

            continue;
        }


        /*
         * Comments
         */

        if (
            char === '/' &&
            next === '/'
        ) {

            lineComment = true;

            i++;

            continue;
        }


        if (
            char === '/' &&
            next === '*'
        ) {

            blockComment = true;

            i++;

            continue;
        }


        /*
         * Strings
         */

        if (
            char === '"' ||
            char === "'" ||
            char === '`'
        ) {

            string = char;

            continue;
        }


        /*
         * Braces
         */

        if (char === '{') {

            depth++;
        }


        if (char === '}') {

            depth--;

            if (depth === 0) {

                return i + 1;
            }
        }
    }


    throw new Error(
        'Could not determine function end.'
    );
}


const validationEnd =
    findFunctionEnd(
        source,
        end
    );


const validationBlock =
    source.slice(
        start,
        validationEnd
    );


/*
 * ---------------------------------------------------------
 * SANDBOX
 * ---------------------------------------------------------
 *
 * Browser-only globals are intentionally absent.
 *
 * This prevents accidental writes to:
 *
 * - localStorage
 * - document
 * - window
 *
 * The validation functions should not need them.
 */

const sandbox = {

    console,

    Set,

    Map,

    Object,

    Array,

    Number,

    String,

    Boolean,

    Date,

    JSON,

    Math,

    RegExp,

    Error,

    TypeError,

    parseInt,

    parseFloat,

    isNaN,

    isFinite
};


vm.createContext(
    sandbox
);


/*
 * ---------------------------------------------------------
 * LOAD REAL APPLICATION VALIDATION CODE
 * ---------------------------------------------------------
 */

try {

    vm.runInContext(
        validationBlock,
        sandbox,
        {
            filename:
                'script.js:import-validation'
        }
    );

} catch (error) {

    console.error(
        '❌ Failed to load real validation code.'
    );

    console.error(
        error.stack ||
        error.message
    );

    process.exit(1);
}


console.log(
    '========================================'
);

console.log(
    ' MyMoneyTracker REAL Import Validation'
);

console.log(
    '========================================'
);

console.log();

console.log(
    'Test file:',
    testFile
);

console.log(
    'Payload size:',
    payload.length,
    'characters'
);

console.log();


/*
 * ---------------------------------------------------------
 * VERIFY FUNCTIONS
 * ---------------------------------------------------------
 */

const requiredFunctions = [

    'normalizeImportRawText',

    'buildImportDiagnostics',

    'validateIncomingImportVersion',

    'normalizeImportPayload',

    'validateImportPayload'
];


for (
    const name of requiredFunctions
) {

    if (
        typeof sandbox[name] !==
        'function'
    ) {

        console.error(
            `❌ Missing function: ${name}`
        );

        process.exit(1);
    }
}


console.log(
    '✅ Real validation functions loaded'
);

console.log();


/*
 * ---------------------------------------------------------
 * 1. RAW NORMALIZATION
 * ---------------------------------------------------------
 */

let normalizedText;


try {

    normalizedText =
        sandbox.normalizeImportRawText(
            payload
        );

} catch (error) {

    console.error(
        '❌ Raw normalization failed.'
    );

    console.error(
        error.stack ||
        error.message
    );

    process.exit(1);
}


console.log(
    'Raw normalization: PASSED'
);

console.log(
    'Normalized length:',
    normalizedText.length
);


/*
 * ---------------------------------------------------------
 * 2. JSON PARSE
 * ---------------------------------------------------------
 */

let parsed;


try {

    parsed =
        JSON.parse(
            normalizedText
        );

} catch (error) {

    console.error(
        '❌ JSON parsing failed.'
    );

    console.error(
        error.message
    );

    process.exit(1);
}


console.log(
    'JSON parsing: PASSED'
);


/*
 * ---------------------------------------------------------
 * 3. DIAGNOSTICS
 * ---------------------------------------------------------
 */

let diagnostics;


try {

    diagnostics =
        sandbox.buildImportDiagnostics(
            parsed
        );

} catch (error) {

    console.error(
        '❌ Diagnostics failed.'
    );

    console.error(
        error.stack ||
        error.message
    );

    process.exit(1);
}


console.log();

console.log(
    'Diagnostics'
);

console.log(
    '-----------'
);

console.log(
    'Expenses:',
    diagnostics.expensesCount
);

console.log(
    'Savings:',
    diagnostics.savingsCount
);

console.log(
    'Budgets:',
    diagnostics.budgetsCount
);

console.log(
    'Budget Periods:',
    diagnostics.budgetPeriodsCount
);


/*
 * ---------------------------------------------------------
 * 4. VERSION VALIDATION
 * ---------------------------------------------------------
 */

const incomingVersion =
    parsed?.meta?.version;


let versionResult;


try {

    versionResult =
        sandbox.validateIncomingImportVersion(
            incomingVersion
        );

} catch (error) {

    console.error(
        '❌ Version validation crashed.'
    );

    console.error(
        error.stack ||
        error.message
    );

    process.exit(1);
}


console.log();

console.log(
    'Version validation'
);

console.log(
    '------------------'
);

console.log(
    'Input:',
    incomingVersion
);

console.log(
    'Supported:',
    versionResult.supported
);

console.log(
    'Normalized:',
    versionResult.normalized
);

console.log(
    'Display:',
    versionResult.display
);


if (
    !versionResult.supported
) {

    console.error(
        '❌ Unsupported import version.'
    );

    process.exit(1);
}


/*
 * ---------------------------------------------------------
 * 5. PAYLOAD NORMALIZATION
 * ---------------------------------------------------------
 */

let normalization;


try {

    normalization =
        sandbox.normalizeImportPayload(
            parsed
        );

} catch (error) {

    console.error(
        '❌ Payload normalization failed.'
    );

    console.error(
        error.stack ||
        error.message
    );

    process.exit(1);
}


console.log();

console.log(
    'Payload normalization'
);

console.log(
    '--------------------'
);

console.log(
    'Unknown fields removed:',
    normalization.report
        .unknownFieldsRemoved
);

console.log(
    'Missing fields recovered:',
    normalization.report
        .missingFieldsRecovered
);

console.log(
    'Warnings:',
    normalization.report
        .warnings
);


/*
 * ---------------------------------------------------------
 * 6. SCHEMA VALIDATION
 * ---------------------------------------------------------
 */

let validation;


try {

    validation =
        sandbox.validateImportPayload(
            normalization.normalized
        );

} catch (error) {

    console.error(
        '❌ Schema validation crashed.'
    );

    console.error(
        error.stack ||
        error.message
    );

    process.exit(1);
}


console.log();

console.log(
    'Schema validation'
);

console.log(
    '-----------------'
);

console.log(
    'Errors:',
    validation.errors
);

console.log(
    'Warnings:',
    validation.warnings
);


/*
 * ---------------------------------------------------------
 * FINAL RESULT
 * ---------------------------------------------------------
 */

console.log();

if (
    validation.errors.length > 0
) {

    console.log(
        '❌ REAL IMPORT VALIDATION FAILED'
    );

    console.log();

    console.log(
        'No application data was modified.'
    );

    console.log(
        'applyImportData() was NOT called.'
    );

    process.exit(1);
}


console.log(
    '========================================'
);

console.log(
    '✅ REAL IMPORT VALIDATION PASSED'
);

console.log(
    '========================================'
);

console.log();

console.log(
    'No localStorage was used.'
);

console.log(
    'No application data was modified.'
);

console.log(
    'applyImportData() was NOT called.'
);
