const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock the storage module to avoid file system side effects
class MockTabStorage {
    constructor() {
        this.data = { tabSets: [], favorites: [] };
    }

    readData() {
        return JSON.parse(JSON.stringify(this.data));
    }

    writeData(data) {
        this.data = JSON.parse(JSON.stringify(data));
        return true;
    }

    saveTabSet(name, tabs, branch = null, isFavorite = false, scope = 'project') {
        const data = this.readData();

        const tabSet = {
            id: Date.now().toString() + Math.random(),
            name: name,
            branch: branch,
            scope: scope,
            tabs: tabs.map(tab => ({
                uri: tab.uri.toString(),
                fileName: tab.fileName,
                languageId: tab.languageId
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isFavorite: isFavorite
        };

        data.tabSets.push(tabSet);

        if (isFavorite && !data.favorites.includes(tabSet.id)) {
            data.favorites.push(tabSet.id);
        }

        this.writeData(data);
        return tabSet;
    }

    getAllTabSets() {
        const data = this.readData();
        return data.tabSets || [];
    }

    getTabSetsByBranch(branch) {
        const data = this.readData();
        return (data.tabSets || []).filter(set => set.branch === branch);
    }

    getFavorites() {
        const data = this.readData();
        return (data.tabSets || []).filter(set => set.isFavorite);
    }

    getTabSetById(id) {
        const data = this.readData();
        return (data.tabSets || []).find(set => set.id === id);
    }

    renameTabSet(id, newName) {
        const data = this.readData();
        const tabSet = data.tabSets.find(set => set.id === id);

        if (tabSet) {
            tabSet.name = newName;
            tabSet.updatedAt = new Date().toISOString();
            this.writeData(data);
            return true;
        }

        return false;
    }

    toggleFavorite(id) {
        const data = this.readData();
        const tabSet = data.tabSets.find(set => set.id === id);

        if (tabSet) {
            tabSet.isFavorite = !tabSet.isFavorite;
            tabSet.updatedAt = new Date().toISOString();

            if (tabSet.isFavorite) {
                if (!data.favorites.includes(id)) {
                    data.favorites.push(id);
                }
            } else {
                data.favorites = data.favorites.filter(fav => fav !== id);
            }

            this.writeData(data);
            return tabSet.isFavorite;
        }

        return false;
    }

    deleteTabSet(id) {
        const data = this.readData();
        const initialLength = data.tabSets.length;

        data.tabSets = data.tabSets.filter(set => set.id !== id);
        data.favorites = data.favorites.filter(fav => fav !== id);

        if (data.tabSets.length < initialLength) {
            this.writeData(data);
            return true;
        }

        return false;
    }

    getLatestTabSetForBranch(branch) {
        const sets = this.getTabSetsByBranch(branch);
        if (sets.length === 0) return null;

        sets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return sets[0];
    }

    getTabSetsByScope(currentBranch = null) {
        const data = this.readData();
        const allSets = data.tabSets || [];

        return allSets.filter(set => {
            // Project-scoped sets are always visible
            if (set.scope === 'project') {
                return true;
            }

            // Branch-scoped sets are only visible on matching branch
            if (set.scope === 'branch' && currentBranch) {
                return set.branch === currentBranch;
            }

            // Legacy sets without scope field (treat as branch-scoped if they have a branch)
            if (!set.scope && set.branch && currentBranch) {
                return set.branch === currentBranch;
            }

            // Legacy sets without scope or branch (treat as project-scoped)
            if (!set.scope && !set.branch) {
                return true;
            }

            return false;
        });
    }

    reset() {
        this.data = { tabSets: [], favorites: [] };
    }
}

describe('Tab Hero Storage Tests', function() {
    let storage;

    beforeEach(function() {
        storage = new MockTabStorage();
    });

    describe('Basic CRUD Operations', function() {
        it('should save a tab set', function() {
            const tabs = [
                { uri: 'file:///test1.js', fileName: 'test1.js', languageId: 'javascript' },
                { uri: 'file:///test2.js', fileName: 'test2.js', languageId: 'javascript' }
            ];

            const tabSet = storage.saveTabSet('Test Set', tabs, 'main', false, 'project');

            assert.strictEqual(tabSet.name, 'Test Set');
            assert.strictEqual(tabSet.branch, 'main');
            assert.strictEqual(tabSet.scope, 'project');
            assert.strictEqual(tabSet.tabs.length, 2);
            assert.strictEqual(tabSet.isFavorite, false);
        });

        it('should retrieve all tab sets', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            storage.saveTabSet('Set 1', tabs, 'main', false, 'project');
            storage.saveTabSet('Set 2', tabs, 'develop', false, 'branch');

            const allSets = storage.getAllTabSets();
            assert.strictEqual(allSets.length, 2);
        });

        it('should rename a tab set', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('Old Name', tabs);

            const success = storage.renameTabSet(tabSet.id, 'New Name');
            const updated = storage.getTabSetById(tabSet.id);

            assert.strictEqual(success, true);
            assert.strictEqual(updated.name, 'New Name');
        });

        it('should delete a tab set', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('To Delete', tabs);

            const success = storage.deleteTabSet(tabSet.id);
            const allSets = storage.getAllTabSets();

            assert.strictEqual(success, true);
            assert.strictEqual(allSets.length, 0);
        });
    });

    describe('Scope Functionality', function() {
        it('should save tab set with branch scope', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('Branch Set', tabs, 'feature-branch', false, 'branch');

            assert.strictEqual(tabSet.scope, 'branch');
            assert.strictEqual(tabSet.branch, 'feature-branch');
        });

        it('should save tab set with project scope', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('Project Set', tabs, 'main', false, 'project');

            assert.strictEqual(tabSet.scope, 'project');
        });

        it('should filter tab sets by scope - show only branch-scoped', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            storage.saveTabSet('Main Branch Set', tabs, 'main', false, 'branch');
            storage.saveTabSet('Feature Branch Set', tabs, 'feature', false, 'branch');
            storage.saveTabSet('Project Set', tabs, null, false, 'project');

            const mainSets = storage.getTabSetsByScope('main');

            // Should include: main branch set (matches branch), project set (always visible)
            assert.strictEqual(mainSets.length, 2);
            assert.strictEqual(mainSets.filter(s => s.name === 'Main Branch Set').length, 1);
            assert.strictEqual(mainSets.filter(s => s.name === 'Project Set').length, 1);
        });

        it('should filter tab sets by scope - show project-scoped on all branches', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            storage.saveTabSet('Main Branch Set', tabs, 'main', false, 'branch');
            storage.saveTabSet('Project Set', tabs, null, false, 'project');

            const featureSets = storage.getTabSetsByScope('feature');

            // Should only include project set (visible everywhere)
            assert.strictEqual(featureSets.length, 1);
            assert.strictEqual(featureSets[0].name, 'Project Set');
        });
    });

    describe('Backward Compatibility', function() {
        it('should handle legacy tab sets without scope field', function() {
            const data = storage.readData();

            // Create a legacy tab set (no scope field)
            data.tabSets.push({
                id: 'legacy-1',
                name: 'Legacy Set',
                branch: 'main',
                tabs: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isFavorite: false
                // Note: no scope field
            });

            storage.writeData(data);

            // Legacy sets with branch should be treated as branch-scoped
            const mainSets = storage.getTabSetsByScope('main');
            assert.strictEqual(mainSets.length, 1);
            assert.strictEqual(mainSets[0].name, 'Legacy Set');

            // Should not appear on different branch
            const featureSets = storage.getTabSetsByScope('feature');
            assert.strictEqual(featureSets.length, 0);
        });

        it('should handle legacy tab sets without scope or branch', function() {
            const data = storage.readData();

            // Create a very old legacy tab set (no scope, no branch)
            data.tabSets.push({
                id: 'legacy-2',
                name: 'Very Old Set',
                tabs: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isFavorite: false
            });

            storage.writeData(data);

            // Should be treated as project-scoped and visible everywhere
            const mainSets = storage.getTabSetsByScope('main');
            assert.strictEqual(mainSets.length, 1);

            const featureSets = storage.getTabSetsByScope('feature');
            assert.strictEqual(featureSets.length, 1);
        });
    });

    describe('Favorites Functionality', function() {
        it('should mark tab set as favorite', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('Favorite Set', tabs, 'main', true, 'project');

            assert.strictEqual(tabSet.isFavorite, true);

            const favorites = storage.getFavorites();
            assert.strictEqual(favorites.length, 1);
            assert.strictEqual(favorites[0].name, 'Favorite Set');
        });

        it('should toggle favorite status', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('Toggle Set', tabs, 'main', false, 'project');

            // Initially not a favorite
            assert.strictEqual(tabSet.isFavorite, false);

            // Toggle to favorite
            const isFavorite1 = storage.toggleFavorite(tabSet.id);
            assert.strictEqual(isFavorite1, true);

            // Toggle back to not favorite
            const isFavorite2 = storage.toggleFavorite(tabSet.id);
            assert.strictEqual(isFavorite2, false);
        });

        it('should remove from favorites list when toggled off', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('Toggle Set', tabs, 'main', true, 'project');

            // Verify it's in favorites
            let favorites = storage.getFavorites();
            assert.strictEqual(favorites.length, 1);

            // Toggle off
            storage.toggleFavorite(tabSet.id);

            // Verify it's removed from favorites
            favorites = storage.getFavorites();
            assert.strictEqual(favorites.length, 0);
        });
    });

    describe('Branch-Specific Operations', function() {
        it('should get tab sets by branch', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            storage.saveTabSet('Main Set 1', tabs, 'main', false, 'branch');
            storage.saveTabSet('Main Set 2', tabs, 'main', false, 'branch');
            storage.saveTabSet('Feature Set', tabs, 'feature', false, 'branch');

            const mainSets = storage.getTabSetsByBranch('main');
            assert.strictEqual(mainSets.length, 2);
        });

        it('should get latest tab set for branch', function(done) {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            storage.saveTabSet('Older Set', tabs, 'main', false, 'branch');

            // Wait a bit to ensure different timestamps
            setTimeout(() => {
                storage.saveTabSet('Newer Set', tabs, 'main', false, 'branch');

                const latest = storage.getLatestTabSetForBranch('main');
                assert.strictEqual(latest.name, 'Newer Set');
                done();
            }, 10);
        });

        it('should return null for branch with no tab sets', function() {
            const latest = storage.getLatestTabSetForBranch('nonexistent');
            assert.strictEqual(latest, null);
        });
    });

    describe('Complex Scenarios', function() {
        it('should handle mixed scope filtering correctly', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            // Create multiple tab sets with different scopes
            storage.saveTabSet('Main Branch Only', tabs, 'main', false, 'branch');
            storage.saveTabSet('Feature Branch Only', tabs, 'feature', false, 'branch');
            storage.saveTabSet('Project Wide 1', tabs, null, false, 'project');
            storage.saveTabSet('Project Wide 2', tabs, 'main', false, 'project');

            // Legacy set with branch (should behave like branch-scoped)
            const data = storage.readData();
            data.tabSets.push({
                id: 'legacy-branch',
                name: 'Legacy Main',
                branch: 'main',
                tabs: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isFavorite: false
            });
            storage.writeData(data);

            // On main branch
            const mainSets = storage.getTabSetsByScope('main');
            assert.strictEqual(mainSets.length, 4); // Main Branch Only, Project Wide 1, Project Wide 2, Legacy Main

            // On feature branch
            const featureSets = storage.getTabSetsByScope('feature');
            assert.strictEqual(featureSets.length, 3); // Feature Branch Only, Project Wide 1, Project Wide 2

            // On different branch
            const developSets = storage.getTabSetsByScope('develop');
            assert.strictEqual(developSets.length, 2); // Project Wide 1, Project Wide 2
        });

        it('should handle favorites across different scopes', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            storage.saveTabSet('Fav Branch Set', tabs, 'main', true, 'branch');
            storage.saveTabSet('Fav Project Set', tabs, null, true, 'project');
            storage.saveTabSet('Regular Set', tabs, 'main', false, 'branch');

            const favorites = storage.getFavorites();
            assert.strictEqual(favorites.length, 2);

            const favoriteNames = favorites.map(f => f.name).sort();
            assert.deepStrictEqual(favoriteNames, ['Fav Branch Set', 'Fav Project Set']);
        });

        it('should preserve scope when renaming', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const tabSet = storage.saveTabSet('Original', tabs, 'main', false, 'branch');

            storage.renameTabSet(tabSet.id, 'Renamed');

            const updated = storage.getTabSetById(tabSet.id);
            assert.strictEqual(updated.name, 'Renamed');
            assert.strictEqual(updated.scope, 'branch');
            assert.strictEqual(updated.branch, 'main');
        });
    });

    describe('Edge Cases', function() {
        it('should handle empty tab sets', function() {
            const tabs = [];
            const tabSet = storage.saveTabSet('Empty Set', tabs, 'main', false, 'project');

            assert.strictEqual(tabSet.tabs.length, 0);
        });

        it('should handle tab sets with many tabs', function() {
            const tabs = Array.from({ length: 100 }, (_, i) => ({
                uri: `file:///test${i}.js`,
                fileName: `test${i}.js`,
                languageId: 'javascript'
            }));

            const tabSet = storage.saveTabSet('Large Set', tabs, 'main', false, 'project');
            assert.strictEqual(tabSet.tabs.length, 100);
        });

        it('should handle special characters in names', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];
            const specialName = 'Test "Set" with \'quotes\' & symbols!@#$%';

            const tabSet = storage.saveTabSet(specialName, tabs, 'main', false, 'project');
            assert.strictEqual(tabSet.name, specialName);
        });

        it('should return false when renaming nonexistent tab set', function() {
            const success = storage.renameTabSet('nonexistent-id', 'New Name');
            assert.strictEqual(success, false);
        });

        it('should return false when deleting nonexistent tab set', function() {
            const success = storage.deleteTabSet('nonexistent-id');
            assert.strictEqual(success, false);
        });

        it('should return false when toggling favorite on nonexistent tab set', function() {
            const result = storage.toggleFavorite('nonexistent-id');
            assert.strictEqual(result, false);
        });

        it('should handle null/undefined branch gracefully', function() {
            const tabs = [{ uri: 'file:///test.js', fileName: 'test.js', languageId: 'javascript' }];

            const tabSet1 = storage.saveTabSet('Null Branch', tabs, null, false, 'project');
            const tabSet2 = storage.saveTabSet('Undefined Branch', tabs, undefined, false, 'project');

            assert.strictEqual(tabSet1.branch, null);
            assert.strictEqual(tabSet2.branch, null);
        });
    });
});
