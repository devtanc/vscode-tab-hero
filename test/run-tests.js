#!/usr/bin/env node

/**
 * Simple test runner that doesn't require mocha to be installed
 * Run with: node test/run-tests.js
 * Or with JUnit XML output: node test/run-tests.js --format=junit
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;
const failures = [];
const testResults = [];
let currentSuite = null;
const startTime = Date.now();

// Parse command line arguments
const args = process.argv.slice(2);
const outputFormat = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'console';
const outputDir = 'test-results';

// Simple test framework
global.describe = function(name, fn) {
    currentSuite = {
        name,
        tests: [],
        startTime: Date.now()
    };

    if (outputFormat === 'console') {
        console.log(`\n${name}`);
    }

    fn();

    currentSuite.endTime = Date.now();
    testResults.push(currentSuite);
};

global.it = function(name, fn) {
    const testStartTime = Date.now();
    let testPassed = false;
    let testError = null;

    try {
        fn((done) => {
            // Support for async tests with done callback
        });
        passedTests++;
        testPassed = true;
        if (outputFormat === 'console') {
            console.log(`  ✓ ${name}`);
        }
    } catch (error) {
        failedTests++;
        testPassed = false;
        testError = error;
        failures.push({ test: name, suite: currentSuite?.name, error });
        if (outputFormat === 'console') {
            console.log(`  ✗ ${name}`);
            console.log(`    ${error.message}`);
        }
    }

    const testEndTime = Date.now();

    if (currentSuite) {
        currentSuite.tests.push({
            name,
            passed: testPassed,
            error: testError,
            duration: (testEndTime - testStartTime) / 1000
        });
    }
};

global.beforeEach = function(fn) {
    // Simple beforeEach support
    const originalIt = global.it;
    global.it = function(name, testFn) {
        fn();
        originalIt(name, testFn);
    };
};

/**
 * Generate JUnit XML format test results
 */
function generateJUnitXML() {
    const totalDuration = (Date.now() - startTime) / 1000;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="Tab Hero Tests" tests="${passedTests + failedTests}" failures="${failedTests}" time="${totalDuration}">\n`;

    testResults.forEach(suite => {
        const suiteDuration = (suite.endTime - suite.startTime) / 1000;
        const suiteFailures = suite.tests.filter(t => !t.passed).length;

        xml += `  <testsuite name="${escapeXml(suite.name)}" tests="${suite.tests.length}" failures="${suiteFailures}" time="${suiteDuration}">\n`;

        suite.tests.forEach(test => {
            xml += `    <testcase name="${escapeXml(test.name)}" classname="${escapeXml(suite.name)}" time="${test.duration}">\n`;

            if (!test.passed && test.error) {
                xml += `      <failure message="${escapeXml(test.error.message)}" type="${escapeXml(test.error.name || 'AssertionError')}">\n`;
                xml += `        ${escapeXml(test.error.stack || test.error.message)}\n`;
                xml += `      </failure>\n`;
            }

            xml += `    </testcase>\n`;
        });

        xml += `  </testsuite>\n`;
    });

    xml += '</testsuites>\n';

    return xml;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Write JUnit XML to file
 */
function writeJUnitXML(xml) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'junit.xml');
    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`\nJUnit XML report written to: ${outputPath}`);
}

// Load and run tests
if (outputFormat === 'console') {
    console.log('Running Tab Hero Tests...\n');
    console.log('='.repeat(60));
}

try {
    require('./storage.test.js');
    require('./integration.test.js');
} catch (error) {
    console.error('Error loading tests:', error.message);
    process.exit(1);
}

// Handle output based on format
if (outputFormat === 'junit') {
    const xml = generateJUnitXML();
    writeJUnitXML(xml);

    // Also print summary to console
    console.log('\nTest Summary:');
    console.log(`  Passed: ${passedTests}`);
    console.log(`  Failed: ${failedTests}`);
    console.log(`  Total:  ${passedTests + failedTests}`);

    if (failedTests > 0) {
        console.log(`\nFailed Tests:`);
        failures.forEach(({ suite, test, error }) => {
            console.log(`  - ${suite} > ${test}`);
            console.log(`    ${error.message}`);
        });
    }
} else {
    // Print summary for console format
    console.log('\n' + '='.repeat(60));
    console.log(`\nTest Summary:`);
    console.log(`  Passed: ${passedTests}`);
    console.log(`  Failed: ${failedTests}`);
    console.log(`  Total:  ${passedTests + failedTests}`);

    if (failedTests > 0) {
        console.log(`\nFailed Tests:`);
        failures.forEach(({ test, error }) => {
            console.log(`  - ${test}`);
            console.log(`    ${error.message}`);
        });
    } else {
        console.log(`\n✓ All tests passed!`);
    }
}

// Exit with appropriate code
process.exit(failedTests > 0 ? 1 : 0);
