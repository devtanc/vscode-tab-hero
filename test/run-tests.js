#!/usr/bin/env node

/**
 * Simple test runner that doesn't require mocha to be installed
 * Run with: node test/run-tests.js
 */

const assert = require('assert');
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Simple test framework
global.describe = function(name, fn) {
    console.log(`\n${name}`);
    fn();
};

global.it = function(name, fn) {
    try {
        fn((done) => {
            // Support for async tests with done callback
        });
        passedTests++;
        console.log(`  ✓ ${name}`);
    } catch (error) {
        failedTests++;
        failures.push({ test: name, error });
        console.log(`  ✗ ${name}`);
        console.log(`    ${error.message}`);
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

// Load and run tests
console.log('Running Tab Hero Tests...\n');
console.log('='.repeat(60));

try {
    require('./storage.test.js');
    require('./integration.test.js');
} catch (error) {
    console.error('Error loading tests:', error.message);
    process.exit(1);
}

// Print summary
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
    process.exit(1);
} else {
    console.log(`\n✓ All tests passed!`);
    process.exit(0);
}
