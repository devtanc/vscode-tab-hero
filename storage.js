const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Storage module for managing persistent tab sets
 */
class TabStorage {
    constructor() {
        this.storageFile = null;
    }

    /**
     * Initialize storage with workspace path
     */
    initialize(workspaceFolder) {
        if (!workspaceFolder) {
            throw new Error('No workspace folder found. Please open a folder or workspace.');
        }

        const vscodeFolder = path.join(workspaceFolder, '.vscode');

        // Create .vscode folder if it doesn't exist
        if (!fs.existsSync(vscodeFolder)) {
            fs.mkdirSync(vscodeFolder, { recursive: true });
        }

        this.storageFile = path.join(vscodeFolder, 'tab-hero.json');

        // Create storage file if it doesn't exist
        if (!fs.existsSync(this.storageFile)) {
            this.writeData({ tabSets: [], favorites: [] });
        }
    }

    /**
     * Read all data from storage
     */
    readData() {
        try {
            const data = fs.readFileSync(this.storageFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading storage file:', error);
            return { tabSets: [], favorites: [] };
        }
    }

    /**
     * Write data to storage
     */
    writeData(data) {
        try {
            fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Error writing storage file:', error);
            return false;
        }
    }

    /**
     * Save a new tab set
     */
    saveTabSet(name, tabs, branch = null, isFavorite = false) {
        const data = this.readData();

        const tabSet = {
            id: Date.now().toString(),
            name: name,
            branch: branch,
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

    /**
     * Get all tab sets
     */
    getAllTabSets() {
        const data = this.readData();
        return data.tabSets || [];
    }

    /**
     * Get tab sets for a specific branch
     */
    getTabSetsByBranch(branch) {
        const data = this.readData();
        return (data.tabSets || []).filter(set => set.branch === branch);
    }

    /**
     * Get favorite tab sets
     */
    getFavorites() {
        const data = this.readData();
        return (data.tabSets || []).filter(set => set.isFavorite);
    }

    /**
     * Get a specific tab set by ID
     */
    getTabSetById(id) {
        const data = this.readData();
        return (data.tabSets || []).find(set => set.id === id);
    }

    /**
     * Update a tab set name
     */
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

    /**
     * Toggle favorite status
     */
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

    /**
     * Delete a tab set
     */
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

    /**
     * Get the most recent tab set for a branch
     */
    getLatestTabSetForBranch(branch) {
        const sets = this.getTabSetsByBranch(branch);
        if (sets.length === 0) return null;

        // Sort by updatedAt descending
        sets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return sets[0];
    }
}

module.exports = new TabStorage();
