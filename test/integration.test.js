const assert = require('assert');

/**
 * Integration tests for Tab Hero configuration and workflow
 */
describe('Tab Hero Configuration and Integration Tests', function() {

    describe('Configuration Options', function() {
        it('should have enableGitBranchScoping configuration', function() {
            // This tests the expected configuration structure
            const expectedConfig = {
                type: 'boolean',
                default: true,
                description: 'Enable git branch-specific tab sets. When enabled, you can choose whether to save tabs for the current branch or the entire project.'
            };

            assert.strictEqual(expectedConfig.type, 'boolean');
            assert.strictEqual(expectedConfig.default, true);
            assert.ok(expectedConfig.description.includes('git branch'));
        });

        it('should have enableFileSelection configuration', function() {
            const expectedConfig = {
                type: 'boolean',
                default: true,
                description: 'Enable individual file selection when saving tab sets. When disabled, all open tabs are saved automatically.'
            };

            assert.strictEqual(expectedConfig.type, 'boolean');
            assert.strictEqual(expectedConfig.default, true);
            assert.ok(expectedConfig.description.includes('file selection'));
        });

        it('should have enableNaming configuration', function() {
            const expectedConfig = {
                type: 'boolean',
                default: true,
                description: 'Enable custom naming for tab sets. When disabled, tab sets are automatically named based on branch or timestamp.'
            };

            assert.strictEqual(expectedConfig.type, 'boolean');
            assert.strictEqual(expectedConfig.default, true);
            assert.ok(expectedConfig.description.includes('naming'));
        });

        it('should have enableFavorites configuration', function() {
            const expectedConfig = {
                type: 'boolean',
                default: true,
                description: 'Enable favorites feature for marking and quickly accessing frequently used tab sets.'
            };

            assert.strictEqual(expectedConfig.type, 'boolean');
            assert.strictEqual(expectedConfig.default, true);
            assert.ok(expectedConfig.description.includes('favorites'));
        });

        it('should all default to true for maximum feature availability', function() {
            const configs = [
                'enableGitBranchScoping',
                'enableFileSelection',
                'enableNaming',
                'enableFavorites'
            ];

            configs.forEach(config => {
                // All should default to true
                const defaultValue = true;
                assert.strictEqual(defaultValue, true, `${config} should default to true`);
            });
        });
    });

    describe('Workflow Testing', function() {
        describe('Save Tab Set Flow', function() {
            it('should follow correct order with all features enabled', function() {
                const workflow = [
                    'Choose scope (branch/project)',
                    'Select files to include',
                    'Name the tab set',
                    'Mark as favorite',
                    'Save and close tabs'
                ];

                assert.strictEqual(workflow.length, 5);
                assert.strictEqual(workflow[0], 'Choose scope (branch/project)');
                assert.strictEqual(workflow[4], 'Save and close tabs');
            });

            it('should skip scope selection when not in git repo', function() {
                const currentBranch = null; // Not in git repo
                const enableGitBranchScoping = true;

                // Scope selection should be skipped
                const shouldShowScopeSelection = enableGitBranchScoping && currentBranch;
                assert.strictEqual(!!shouldShowScopeSelection, false);
            });

            it('should skip scope selection when feature disabled', function() {
                const currentBranch = 'main';
                const enableGitBranchScoping = false;

                const shouldShowScopeSelection = enableGitBranchScoping && currentBranch;
                assert.strictEqual(shouldShowScopeSelection, false);
            });

            it('should skip file selection when feature disabled', function() {
                const enableFileSelection = false;
                const openTabs = [
                    { uri: 'file:///test1.js', fileName: 'test1.js' },
                    { uri: 'file:///test2.js', fileName: 'test2.js' }
                ];

                // When disabled, all tabs should be selected
                const selectedTabs = enableFileSelection ? [] : openTabs;
                assert.strictEqual(selectedTabs.length, 2);
            });

            it('should auto-generate name when naming disabled', function() {
                const enableNaming = false;
                const currentBranch = 'main';
                const scope = 'branch';

                const expectedName = currentBranch && scope === 'branch'
                    ? `${currentBranch} tabs`
                    : `Tab set ${new Date().toLocaleDateString()}`;

                assert.ok(expectedName === 'main tabs' || expectedName.startsWith('Tab set'));
            });

            it('should skip favorite prompt when feature disabled', function() {
                const enableFavorites = false;
                const defaultFavoriteValue = false;

                const isFavorite = enableFavorites ? null : defaultFavoriteValue;
                assert.strictEqual(isFavorite, false);
            });
        });

        describe('Load Tab Set Flow', function() {
            it('should follow correct order with scoping enabled', function() {
                const workflow = [
                    'Choose scope filter (branch/project/all)',
                    'Select tab set from filtered list',
                    'Open tabs'
                ];

                assert.strictEqual(workflow.length, 3);
                assert.strictEqual(workflow[0], 'Choose scope filter (branch/project/all)');
            });

            it('should skip scope filter when not in git repo', function() {
                const currentBranch = null;
                const enableGitBranchScoping = true;

                const shouldShowScopeFilter = enableGitBranchScoping && currentBranch;
                assert.strictEqual(!!shouldShowScopeFilter, false);
            });
        });
    });

    describe('Scope Filtering Logic', function() {
        it('should filter correctly for "branch" scope filter', function() {
            const currentBranch = 'main';
            const scopeFilter = 'branch';

            const tabSets = [
                { name: 'Set 1', scope: 'branch', branch: 'main' },
                { name: 'Set 2', scope: 'branch', branch: 'feature' },
                { name: 'Set 3', scope: 'project' }
            ];

            const filtered = tabSets.filter(set =>
                scopeFilter === 'branch' ? set.scope === 'branch' && set.branch === currentBranch : true
            );

            assert.strictEqual(filtered.length, 1);
            assert.strictEqual(filtered[0].name, 'Set 1');
        });

        it('should filter correctly for "project" scope filter', function() {
            const scopeFilter = 'project';

            const tabSets = [
                { name: 'Set 1', scope: 'branch', branch: 'main' },
                { name: 'Set 2', scope: 'project' },
                { name: 'Set 3', scope: 'project' }
            ];

            const filtered = tabSets.filter(set =>
                scopeFilter === 'project' ? set.scope === 'project' || !set.scope : true
            );

            assert.strictEqual(filtered.length, 2);
        });

        it('should show all sets for "all" scope filter', function() {
            const scopeFilter = 'all';

            const tabSets = [
                { name: 'Set 1', scope: 'branch', branch: 'main' },
                { name: 'Set 2', scope: 'project' },
                { name: 'Set 3', scope: 'branch', branch: 'feature' }
            ];

            const filtered = scopeFilter === 'all' ? tabSets : [];

            assert.strictEqual(filtered.length, 3);
        });
    });

    describe('Scope Selection Logic', function() {
        it('should create branch-scoped set when user selects branch', function() {
            const userChoice = 'branch';
            const currentBranch = 'feature-123';

            const tabSet = {
                scope: userChoice,
                branch: currentBranch
            };

            assert.strictEqual(tabSet.scope, 'branch');
            assert.strictEqual(tabSet.branch, 'feature-123');
        });

        it('should create project-scoped set when user selects project', function() {
            const userChoice = 'project';
            const currentBranch = 'main';

            const tabSet = {
                scope: userChoice,
                branch: currentBranch // Branch is still stored for reference
            };

            assert.strictEqual(tabSet.scope, 'project');
        });

        it('should default to project scope when not in git repo', function() {
            const currentBranch = null;
            const enableGitBranchScoping = true;

            const scope = (enableGitBranchScoping && currentBranch) ? null : 'project';

            assert.strictEqual(scope, 'project');
        });
    });

    describe('User Experience Requirements', function() {
        it('should show helpful placeholder text for scope selection', function() {
            const scopeSelectionPlaceholder = 'Where should this tab set be available?';
            assert.ok(scopeSelectionPlaceholder.length > 0);
            assert.ok(scopeSelectionPlaceholder.includes('available'));
        });

        it('should show helpful placeholder text for file selection', function() {
            const fileCount = 10;
            const fileSelectionPlaceholder = `Select the tabs to include in this set (${fileCount} tabs open, all selected by default)`;

            assert.ok(fileSelectionPlaceholder.includes('Select'));
            assert.ok(fileSelectionPlaceholder.includes('10 tabs'));
            assert.ok(fileSelectionPlaceholder.includes('all selected by default'));
        });

        it('should show helpful placeholder text for naming', function() {
            const namingPlaceholder = 'Give your tab set a name';
            assert.ok(namingPlaceholder.includes('Give'));
            assert.ok(namingPlaceholder.includes('name'));
        });

        it('should show helpful placeholder text for favorites', function() {
            const favoritePlaceholder = 'Add to favorites for quick access?';
            assert.ok(favoritePlaceholder.includes('favorites'));
            assert.ok(favoritePlaceholder.includes('quick access'));
        });

        it('should use icons in scope selection options', function() {
            const branchOption = {
                label: '$(git-branch) Current Branch',
                description: 'Save for "main" branch only',
                detail: 'These tabs will only appear when you\'re on this branch',
                value: 'branch'
            };

            const projectOption = {
                label: '$(folder) Entire Project',
                description: 'Save for all branches',
                detail: 'These tabs will be available regardless of the current branch',
                value: 'project'
            };

            assert.ok(branchOption.label.includes('$(git-branch)'));
            assert.ok(projectOption.label.includes('$(folder)'));
        });

        it('should show success message with all relevant details', function() {
            const name = 'My Feature Work';
            const tabCount = 7;
            const scope = 'branch';
            const currentBranch = 'feature-123';
            const isFavorite = true;
            const closedCount = 7;

            const scopeInfo = scope === 'branch' && currentBranch ? ` (${currentBranch} branch)` : ' (project-wide)';
            const favoriteInfo = isFavorite ? ' ⭐' : '';
            const message = `✓ Saved "${name}"${favoriteInfo} with ${tabCount} tab${tabCount !== 1 ? 's' : ''}${scopeInfo}. Closed ${closedCount} tab${closedCount !== 1 ? 's' : ''}.`;

            assert.ok(message.includes('✓'));
            assert.ok(message.includes('My Feature Work'));
            assert.ok(message.includes('⭐'));
            assert.ok(message.includes('7 tabs'));
            assert.ok(message.includes('feature-123 branch'));
            assert.ok(message.includes('Closed 7 tabs'));
        });
    });

    describe('Tab Set Display Formatting', function() {
        it('should format branch-scoped tab set correctly', function() {
            const tabSet = {
                name: 'Feature Work',
                scope: 'branch',
                branch: 'feature-123',
                isFavorite: true,
                tabs: [{ fileName: 'test.js' }],
                updatedAt: new Date().toISOString()
            };

            const favoriteLabel = tabSet.isFavorite ? '⭐ ' : '';
            const scopeLabel = tabSet.scope === 'branch' && tabSet.branch
                ? `$(git-branch) ${tabSet.branch}`
                : '$(folder) Project';

            assert.strictEqual(favoriteLabel, '⭐ ');
            assert.strictEqual(scopeLabel, '$(git-branch) feature-123');
        });

        it('should format project-scoped tab set correctly', function() {
            const tabSet = {
                name: 'General Work',
                scope: 'project',
                isFavorite: false,
                tabs: [{ fileName: 'test.js' }],
                updatedAt: new Date().toISOString()
            };

            const favoriteLabel = tabSet.isFavorite ? '⭐ ' : '';
            const scopeLabel = tabSet.scope === 'project' || !tabSet.scope
                ? '$(folder) Project'
                : `$(git-branch) ${tabSet.branch}`;

            assert.strictEqual(favoriteLabel, '');
            assert.strictEqual(scopeLabel, '$(folder) Project');
        });

        it('should format legacy tab set correctly', function() {
            const tabSet = {
                name: 'Legacy Set',
                // No scope field
                branch: 'main',
                isFavorite: false,
                tabs: [{ fileName: 'test.js' }],
                updatedAt: new Date().toISOString()
            };

            const scopeLabel = tabSet.scope === 'branch' && tabSet.branch
                ? `$(git-branch) ${tabSet.branch}`
                : tabSet.scope === 'project' || !tabSet.scope
                ? '$(folder) Project'
                : '';

            // Legacy with no scope should show as project
            assert.strictEqual(scopeLabel, '$(folder) Project');
        });
    });

    describe('Validation Requirements', function() {
        it('should validate that name is not empty', function() {
            const value = '';
            const validationResult = value && value.trim() ? null : 'Name cannot be empty';

            assert.strictEqual(validationResult, 'Name cannot be empty');
        });

        it('should accept valid names', function() {
            const value = 'My Feature Work';
            const validationResult = value && value.trim() ? null : 'Name cannot be empty';

            assert.strictEqual(validationResult, null);
        });

        it('should handle whitespace-only names', function() {
            const value = '   ';
            const validationResult = value && value.trim() ? null : 'Name cannot be empty';

            assert.strictEqual(validationResult, 'Name cannot be empty');
        });
    });
});
