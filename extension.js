const vscode = require('vscode');
const storage = require('./storage');
const gitHelper = require('./git-helper');

/**
 * Get all currently open tab URIs
 */
function getOpenTabs() {
    // Get all visible text editors (tabs)
    const openEditors = vscode.window.tabGroups.all
        .flatMap(group => group.tabs)
        .filter(tab => tab.input instanceof vscode.TabInputText)
        .map(tab => tab.input.uri);

    // Also include any open text documents
    const openDocuments = vscode.workspace.textDocuments
        .filter(doc => !doc.isUntitled && doc.uri.scheme === 'file')
        .map(doc => doc.uri);

    // Combine and deduplicate
    const allUris = [...openEditors, ...openDocuments];
    const uniqueUris = [...new Map(allUris.map(uri => [uri.toString(), uri])).values()];

    return uniqueUris;
}

/**
 * Get workspace folder path
 */
function getWorkspacePath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }
    return workspaceFolders[0].uri.fsPath;
}

/**
 * Format a tab set for the quick pick menu
 */
function formatTabSetForQuickPick(tabSet) {
    const branchLabel = tabSet.branch ? ` [${tabSet.branch}]` : '';
    const favoriteLabel = tabSet.isFavorite ? ' ⭐' : '';
    const tabCount = tabSet.tabs.length;
    const date = new Date(tabSet.updatedAt).toLocaleString();

    return {
        label: `${tabSet.name}${favoriteLabel}${branchLabel}`,
        description: `${tabCount} tab${tabCount !== 1 ? 's' : ''} • ${date}`,
        detail: tabSet.tabs.map(t => t.fileName).join(', '),
        tabSet: tabSet
    };
}

/**
 * Close tabs by their URIs
 */
async function closeTabsByUris(urisToClose) {
    let closedCount = 0;
    const uriStrings = urisToClose.map(uri => uri.toString());

    // Iterate through all tab groups
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (tab.input instanceof vscode.TabInputText) {
                const tabUriString = tab.input.uri.toString();

                if (uriStrings.includes(tabUriString)) {
                    try {
                        await vscode.window.tabGroups.close(tab);
                        closedCount++;
                    } catch (error) {
                        console.error(`Failed to close tab ${tabUriString}:`, error);
                    }
                }
            }
        }
    }

    return closedCount;
}

function activate(context) {
    console.log('Tab Hero is now active!');

    // Initialize storage
    try {
        const workspacePath = getWorkspacePath();
        if (workspacePath) {
            storage.initialize(workspacePath);
        }
    } catch (error) {
        console.error('Failed to initialize storage:', error);
    }

    // Command: Save Tab Set
    let saveTabSet = vscode.commands.registerCommand('extension.saveTabSet', async function () {
        const workspacePath = getWorkspacePath();
        if (!workspacePath) {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
            return;
        }

        try {
            // Get open tabs
            const openTabs = getOpenTabs();

            if (openTabs.length === 0) {
                vscode.window.showWarningMessage('No tabs are currently open.');
                return;
            }

            // Convert URIs to documents with metadata
            const allTabsWithInfo = await Promise.all(
                openTabs.map(async (uri) => {
                    try {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const fileName = uri.fsPath.split(/[\\/]/).pop();
                        const relativePath = vscode.workspace.asRelativePath(uri.fsPath);

                        return {
                            uri: uri,
                            fileName: fileName,
                            languageId: doc.languageId,
                            relativePath: relativePath
                        };
                    } catch (error) {
                        const fileName = uri.fsPath.split(/[\\/]/).pop();
                        return {
                            uri: uri,
                            fileName: fileName,
                            languageId: 'unknown',
                            relativePath: vscode.workspace.asRelativePath(uri.fsPath)
                        };
                    }
                })
            );

            // Show multi-select quick pick for tab selection
            const tabPickItems = allTabsWithInfo.map(tab => ({
                label: tab.fileName,
                description: tab.relativePath !== tab.fileName ? tab.relativePath : '',
                detail: `Language: ${tab.languageId}`,
                picked: true, // All selected by default
                tabInfo: tab
            }));

            const selectedItems = await vscode.window.showQuickPick(tabPickItems, {
                canPickMany: true,
                placeHolder: 'Select tabs to include in this set (all selected by default)'
            });

            if (!selectedItems || selectedItems.length === 0) {
                return; // User cancelled or selected nothing
            }

            // Get current git branch
            const currentBranch = await gitHelper.getCurrentBranch(workspacePath);

            // Ask user for a name
            const defaultName = currentBranch ? `${currentBranch} tabs` : 'Unnamed tab set';
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for this tab set',
                placeHolder: defaultName,
                value: defaultName
            });

            if (!name) {
                return; // User cancelled
            }

            // Ask if this should be a favorite
            const favoriteChoice = await vscode.window.showQuickPick(
                ['No', 'Yes'],
                {
                    placeHolder: 'Mark as favorite?'
                }
            );

            if (favoriteChoice === undefined) {
                return; // User cancelled
            }

            const isFavorite = favoriteChoice === 'Yes';

            // Get the selected tabs
            const tabs = selectedItems.map(item => item.tabInfo);

            // Save the tab set
            const tabSet = storage.saveTabSet(name, tabs, currentBranch, isFavorite);

            // Close all tabs that were saved
            const closedCount = await closeTabsByUris(tabs.map(t => t.uri));

            const branchInfo = currentBranch ? ` (branch: ${currentBranch})` : '';
            vscode.window.showInformationMessage(
                `✓ Saved "${name}" with ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}${branchInfo}. Closed ${closedCount} tab${closedCount !== 1 ? 's' : ''}.`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save tab set: ${error.message}`);
        }
    });

    // Command: Open/Restore Tab Set
    let openTabSet = vscode.commands.registerCommand('extension.openTabSet', async function () {
        const workspacePath = getWorkspacePath();
        if (!workspacePath) {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
            return;
        }

        try {
            const allTabSets = storage.getAllTabSets();

            if (allTabSets.length === 0) {
                vscode.window.showInformationMessage('No saved tab sets found. Save one first!');
                return;
            }

            // Sort: favorites first, then by updated date
            allTabSets.sort((a, b) => {
                if (a.isFavorite && !b.isFavorite) return -1;
                if (!a.isFavorite && b.isFavorite) return 1;
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });

            // Show quick pick
            const items = allTabSets.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a tab set to restore'
            });

            if (!selected) {
                return; // User cancelled
            }

            // Open all tabs from the selected set
            const tabSet = selected.tabSet;
            let openedCount = 0;
            let failedCount = 0;

            for (const tab of tabSet.tabs) {
                try {
                    const uri = vscode.Uri.parse(tab.uri);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { preview: false });
                    openedCount++;
                } catch (error) {
                    console.error(`Failed to open ${tab.fileName}:`, error);
                    failedCount++;
                }
            }

            const message = `Opened ${openedCount} tab${openedCount !== 1 ? 's' : ''}` +
                (failedCount > 0 ? ` (${failedCount} failed)` : '');
            vscode.window.showInformationMessage(message);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open tab set: ${error.message}`);
        }
    });

    // Command: Restore Branch Tabs (restore most recent for current branch)
    let restoreBranchTabs = vscode.commands.registerCommand('extension.restoreBranchTabs', async function () {
        const workspacePath = getWorkspacePath();
        if (!workspacePath) {
            vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
            return;
        }

        try {
            const currentBranch = await gitHelper.getCurrentBranch(workspacePath);

            if (!currentBranch) {
                vscode.window.showWarningMessage('Not a git repository or unable to detect branch.');
                return;
            }

            const tabSet = storage.getLatestTabSetForBranch(currentBranch);

            if (!tabSet) {
                vscode.window.showInformationMessage(`No saved tab sets found for branch "${currentBranch}".`);
                return;
            }

            // Open all tabs
            let openedCount = 0;
            let failedCount = 0;

            for (const tab of tabSet.tabs) {
                try {
                    const uri = vscode.Uri.parse(tab.uri);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { preview: false });
                    openedCount++;
                } catch (error) {
                    console.error(`Failed to open ${tab.fileName}:`, error);
                    failedCount++;
                }
            }

            const message = `Restored "${tabSet.name}" with ${openedCount} tab${openedCount !== 1 ? 's' : ''}` +
                (failedCount > 0 ? ` (${failedCount} failed)` : '');
            vscode.window.showInformationMessage(message);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to restore branch tabs: ${error.message}`);
        }
    });

    // Command: Rename Tab Set
    let renameTabSet = vscode.commands.registerCommand('extension.renameTabSet', async function () {
        try {
            const allTabSets = storage.getAllTabSets();

            if (allTabSets.length === 0) {
                vscode.window.showInformationMessage('No saved tab sets found.');
                return;
            }

            // Sort by updated date
            allTabSets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = allTabSets.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a tab set to rename'
            });

            if (!selected) {
                return;
            }

            const newName = await vscode.window.showInputBox({
                prompt: 'Enter new name',
                placeHolder: 'New tab set name',
                value: selected.tabSet.name
            });

            if (!newName) {
                return;
            }

            const success = storage.renameTabSet(selected.tabSet.id, newName);

            if (success) {
                vscode.window.showInformationMessage(`Renamed to "${newName}"`);
            } else {
                vscode.window.showErrorMessage('Failed to rename tab set');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename tab set: ${error.message}`);
        }
    });

    // Command: Delete Tab Set
    let deleteTabSet = vscode.commands.registerCommand('extension.deleteTabSet', async function () {
        try {
            const allTabSets = storage.getAllTabSets();

            if (allTabSets.length === 0) {
                vscode.window.showInformationMessage('No saved tab sets found.');
                return;
            }

            // Sort by updated date
            allTabSets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = allTabSets.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a tab set to delete'
            });

            if (!selected) {
                return;
            }

            // Confirm deletion
            const confirm = await vscode.window.showWarningMessage(
                `Delete "${selected.tabSet.name}"?`,
                { modal: true },
                'Delete'
            );

            if (confirm !== 'Delete') {
                return;
            }

            const success = storage.deleteTabSet(selected.tabSet.id);

            if (success) {
                vscode.window.showInformationMessage(`Deleted "${selected.tabSet.name}"`);
            } else {
                vscode.window.showErrorMessage('Failed to delete tab set');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete tab set: ${error.message}`);
        }
    });

    // Command: Toggle Favorite
    let toggleFavorite = vscode.commands.registerCommand('extension.toggleFavorite', async function () {
        try {
            const allTabSets = storage.getAllTabSets();

            if (allTabSets.length === 0) {
                vscode.window.showInformationMessage('No saved tab sets found.');
                return;
            }

            // Sort by updated date
            allTabSets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = allTabSets.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a tab set to toggle favorite'
            });

            if (!selected) {
                return;
            }

            const isFavorite = storage.toggleFavorite(selected.tabSet.id);

            const message = isFavorite
                ? `⭐ Added "${selected.tabSet.name}" to favorites`
                : `Removed "${selected.tabSet.name}" from favorites`;

            vscode.window.showInformationMessage(message);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to toggle favorite: ${error.message}`);
        }
    });

    // Command: List Favorites
    let listFavorites = vscode.commands.registerCommand('extension.listFavorites', async function () {
        try {
            const favorites = storage.getFavorites();

            if (favorites.length === 0) {
                vscode.window.showInformationMessage('No favorite tab sets. Mark a tab set as favorite!');
                return;
            }

            // Sort by updated date
            favorites.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = favorites.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a favorite tab set to restore'
            });

            if (!selected) {
                return;
            }

            // Open all tabs
            const tabSet = selected.tabSet;
            let openedCount = 0;
            let failedCount = 0;

            for (const tab of tabSet.tabs) {
                try {
                    const uri = vscode.Uri.parse(tab.uri);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { preview: false });
                    openedCount++;
                } catch (error) {
                    console.error(`Failed to open ${tab.fileName}:`, error);
                    failedCount++;
                }
            }

            const message = `Opened ${openedCount} tab${openedCount !== 1 ? 's' : ''}` +
                (failedCount > 0 ? ` (${failedCount} failed)` : '');
            vscode.window.showInformationMessage(message);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open favorites: ${error.message}`);
        }
    });

    context.subscriptions.push(
        saveTabSet,
        openTabSet,
        restoreBranchTabs,
        renameTabSet,
        deleteTabSet,
        toggleFavorite,
        listFavorites
    );
}

exports.activate = activate;

function deactivate() {
}

exports.deactivate = deactivate;
