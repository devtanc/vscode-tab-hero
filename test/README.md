# Tab Hero Test Suite

This directory contains comprehensive unit and integration tests for Tab Hero.

## Running Tests

### Quick Start (No Installation Required)
```bash
# Console output (default)
node test/run-tests.js

# JUnit XML output (for CI/CD)
node test/run-tests.js --format=junit
```

### With Mocha (After npm install)
```bash
npm test
```

### Output Formats

**Console Format** (default): Human-readable output with colored indicators
- Displays test progress in real-time
- Shows detailed failure messages
- Perfect for local development

**JUnit XML Format**: Machine-readable format for CI/CD integration
- Generates `test-results/junit.xml`
- Compatible with GitHub Actions and other CI systems
- Includes test timing and failure details
- Use with `--format=junit` flag

## Test Coverage

### Storage Tests (`storage.test.js`)
Tests for the core storage functionality and data persistence:

- **Basic CRUD Operations** (4 tests)
  - Saving, retrieving, renaming, and deleting tab sets

- **Scope Functionality** (4 tests)
  - Branch-scoped vs project-scoped tab sets
  - Scope-based filtering logic

- **Backward Compatibility** (2 tests)
  - Legacy tab sets without scope field
  - Legacy tab sets without scope or branch

- **Favorites Functionality** (3 tests)
  - Marking favorites
  - Toggling favorite status
  - Managing favorites list

- **Branch-Specific Operations** (3 tests)
  - Getting tab sets by branch
  - Finding latest tab set for a branch

- **Complex Scenarios** (3 tests)
  - Mixed scope filtering
  - Favorites across different scopes
  - Scope preservation during operations

- **Edge Cases** (7 tests)
  - Empty tab sets
  - Large tab sets (100+ tabs)
  - Special characters in names
  - Nonexistent tab sets
  - Null/undefined handling

### Integration Tests (`integration.test.js`)
Tests for configuration, workflows, and user experience:

- **Configuration Options** (5 tests)
  - All four configuration settings
  - Default values

- **Workflow Testing** (8 tests)
  - Complete save tab set flow
  - Complete load tab set flow
  - Conditional feature skipping

- **Scope Filtering Logic** (3 tests)
  - Branch filter
  - Project filter
  - All filter

- **Scope Selection Logic** (3 tests)
  - Branch scope creation
  - Project scope creation
  - Default scope handling

- **User Experience Requirements** (6 tests)
  - Helpful placeholder text
  - Icon usage
  - Success messages

- **Tab Set Display Formatting** (3 tests)
  - Branch-scoped formatting
  - Project-scoped formatting
  - Legacy tab set formatting

- **Validation Requirements** (3 tests)
  - Name validation
  - Empty/whitespace handling

## Test Statistics

- **Total Tests**: 57
- **Test Files**: 2
- **Coverage Areas**:
  - Storage layer
  - Scope functionality
  - Configuration system
  - User workflows
  - UI/UX requirements
  - Backward compatibility

## What These Tests Verify

### Core Requirements ✓
- [x] Scope selection (branch vs project) when saving
- [x] Scope filtering when loading
- [x] Configuration options for all features
- [x] User-friendly wording and guidance
- [x] Backward compatibility with existing data

### Save Tab Set Flow ✓
1. Choose scope (branch/project) - when enabled and in git repo
2. Select files to include - when file selection enabled
3. Name the tab set - when naming enabled
4. Mark as favorite - when favorites enabled
5. Save and close selected tabs

### Load Tab Set Flow ✓
1. Choose scope filter - when enabled and in git repo
2. Select tab set from filtered list
3. Open all tabs

### Configuration Options ✓
- `enableGitBranchScoping` - Git branch-specific scoping
- `enableFileSelection` - Individual file selection
- `enableNaming` - Custom naming
- `enableFavorites` - Favorites feature

### Edge Cases ✓
- Legacy data without scope field
- Non-git repositories
- Disabled features
- Empty/null/undefined values
- Special characters
- Large datasets

## Adding New Tests

When adding new functionality:

1. Add unit tests to `storage.test.js` for storage-related features
2. Add integration tests to `integration.test.js` for workflow/UX features
3. Follow the existing test structure with descriptive names
4. Test both happy path and edge cases
5. Run `node test/run-tests.js` to verify all tests pass

## Test Framework

Tests use Node.js `assert` module with a simple test runner (`run-tests.js`) that provides:
- `describe()` for test suites
- `it()` for individual tests
- `beforeEach()` for setup
- Mocha-compatible syntax

This allows tests to run without dependencies and also work with full mocha when installed.
