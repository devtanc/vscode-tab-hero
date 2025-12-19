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
    const favoriteLabel = tabSet.isFavorite ? '⭐ ' : '';
    const scopeLabel = tabSet.scope === 'branch' && tabSet.branch
        ? `$(git-branch) ${tabSet.branch}`
        : tabSet.scope === 'project' || !tabSet.scope
        ? '$(folder) Project'
        : '';
    const tabCount = tabSet.tabs.length;
    const date = new Date(tabSet.updatedAt).toLocaleString();

    return {
        label: `${favoriteLabel}${tabSet.name}`,
        description: `${scopeLabel} • ${tabCount} tab${tabCount !== 1 ? 's' : ''}`,
        detail: `Last modified: ${date} • Files: ${tabSet.tabs.map(t => t.fileName).join(', ')}`,
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
            // Get configuration settings
            const config = vscode.workspace.getConfiguration('tabHero');
            const enableGitBranchScoping = config.get('enableGitBranchScoping', true);
            const enableFileSelection = config.get('enableFileSelection', true);
            const enableNaming = config.get('enableNaming', true);
            const enableFavorites = config.get('enableFavorites', true);

            // Get open tabs
            const openTabs = getOpenTabs();

            if (openTabs.length === 0) {
                vscode.window.showWarningMessage('No tabs are currently open.');
                return;
            }

            // Get current git branch
            const currentBranch = await gitHelper.getCurrentBranch(workspacePath);

            // Step 1: Ask for scope (branch or project) if git branch scoping is enabled
            let scope = 'project';
            if (enableGitBranchScoping && currentBranch) {
                const scopeChoice = await vscode.window.showQuickPick(
                    [
                        {
                            label: '$(git-branch) Current Branch',
                            description: `Save for "${currentBranch}" branch only`,
                            detail: 'These tabs will only appear when you\'re on this branch',
                            value: 'branch'
                        },
                        {
                            label: '$(folder) Entire Project',
                            description: 'Save for all branches',
                            detail: 'These tabs will be available regardless of the current branch',
                            value: 'project'
                        }
                    ],
                    {
                        placeHolder: 'Where should this tab set be available?'
                    }
                );

                if (!scopeChoice) {
                    return; // User cancelled
                }

                scope = scopeChoice.value;
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

            // Step 2: File selection (if enabled)
            let selectedItems = allTabsWithInfo;
            if (enableFileSelection) {
                const tabPickItems = allTabsWithInfo.map(tab => ({
                    label: tab.fileName,
                    description: tab.relativePath !== tab.fileName ? tab.relativePath : '',
                    detail: `Language: ${tab.languageId}`,
                    picked: true, // All selected by default
                    tabInfo: tab
                }));

                const picked = await vscode.window.showQuickPick(tabPickItems, {
                    canPickMany: true,
                    placeHolder: `Select the tabs to include in this set (${openTabs.length} tabs open, all selected by default)`
                });

                if (!picked || picked.length === 0) {
                    return; // User cancelled or selected nothing
                }

                selectedItems = picked.map(item => item.tabInfo);
            }

            // Step 3: Ask user for a name (if enabled)
            let name;
            if (enableNaming) {
                const scopeLabel = scope === 'branch' ? currentBranch : 'project';
                const defaultName = currentBranch && scope === 'branch'
                    ? `${currentBranch} tabs`
                    : `Tab set ${new Date().toLocaleDateString()}`;

                name = await vscode.window.showInputBox({
                    prompt: 'Give your tab set a name',
                    placeHolder: defaultName,
                    value: defaultName,
                    validateInput: (value) => {
                        return value && value.trim() ? null : 'Name cannot be empty';
                    }
                });

                if (!name) {
                    return; // User cancelled
                }
            } else {
                // Auto-generate name
                name = currentBranch && scope === 'branch'
                    ? `${currentBranch} tabs`
                    : `Tab set ${new Date().toLocaleString()}`;
            }

            // Step 4: Ask if this should be a favorite (if enabled)
            let isFavorite = false;
            if (enableFavorites) {
                const favoriteChoice = await vscode.window.showQuickPick(
                    [
                        {
                            label: 'No',
                            description: 'Regular tab set'
                        },
                        {
                            label: 'Yes',
                            description: 'Quick access from favorites list'
                        }
                    ],
                    {
                        placeHolder: 'Add to favorites for quick access?'
                    }
                );

                if (favoriteChoice === undefined) {
                    return; // User cancelled
                }

                isFavorite = favoriteChoice.label === 'Yes';
            }

            // Get the selected tabs
            const tabs = selectedItems;

            // Save the tab set
            const tabSet = storage.saveTabSet(name, tabs, currentBranch, isFavorite, scope);

            // Close all tabs that were saved
            const closedCount = await closeTabsByUris(tabs.map(t => t.uri));

            const scopeInfo = scope === 'branch' && currentBranch ? ` (${currentBranch} branch)` : ' (project-wide)';
            const favoriteInfo = isFavorite ? ' ⭐' : '';
            vscode.window.showInformationMessage(
                `✓ Saved "${name}"${favoriteInfo} with ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}${scopeInfo}. Closed ${closedCount} tab${closedCount !== 1 ? 's' : ''}.`
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
            // Get configuration settings
            const config = vscode.workspace.getConfiguration('tabHero');
            const enableGitBranchScoping = config.get('enableGitBranchScoping', true);

            // Get current git branch
            const currentBranch = await gitHelper.getCurrentBranch(workspacePath);

            // Step 1: Ask for scope (branch or project) if git branch scoping is enabled and in a git repo
            let scopeFilter = null; // null means show all
            if (enableGitBranchScoping && currentBranch) {
                const scopeChoice = await vscode.window.showQuickPick(
                    [
                        {
                            label: '$(git-branch) Current Branch',
                            description: `Show tab sets for "${currentBranch}" branch`,
                            detail: 'Only show tab sets saved for this branch',
                            value: 'branch'
                        },
                        {
                            label: '$(folder) Entire Project',
                            description: 'Show project-wide tab sets',
                            detail: 'Only show tab sets available across all branches',
                            value: 'project'
                        },
                        {
                            label: '$(list-unordered) All Tab Sets',
                            description: 'Show everything',
                            detail: 'Show all tab sets regardless of scope',
                            value: 'all'
                        }
                    ],
                    {
                        placeHolder: 'Which tab sets would you like to see?'
                    }
                );

                if (!scopeChoice) {
                    return; // User cancelled
                }

                scopeFilter = scopeChoice.value;
            }

            // Get tab sets based on scope filter
            let allTabSets;
            if (scopeFilter === 'all') {
                allTabSets = storage.getAllTabSets();
            } else if (scopeFilter === 'branch') {
                allTabSets = storage.getTabSetsByScope(currentBranch).filter(set => set.scope === 'branch');
            } else if (scopeFilter === 'project') {
                allTabSets = storage.getAllTabSets().filter(set => set.scope === 'project' || !set.scope);
            } else {
                // No scope filter (git not enabled or not in git repo)
                allTabSets = storage.getTabSetsByScope(currentBranch);
            }

            if (allTabSets.length === 0) {
                const scopeMsg = scopeFilter === 'branch' ? ' for this branch' :
                               scopeFilter === 'project' ? ' for the project' : '';
                vscode.window.showInformationMessage(`No saved tab sets found${scopeMsg}. Save one first!`);
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
                placeHolder: `Select a tab set to open (${allTabSets.length} available)`
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

            const message = `Opened ${openedCount} tab${openedCount !== 1 ? 's' : ''} from "${tabSet.name}"` +
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
                vscode.window.showWarningMessage('This is not a git repository or unable to detect the current branch.');
                return;
            }

            const tabSet = storage.getLatestTabSetForBranch(currentBranch);

            if (!tabSet) {
                vscode.window.showInformationMessage(`No saved tab sets found for branch "${currentBranch}". Save some tabs first!`);
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

            const message = `✓ Opened "${tabSet.name}" with ${openedCount} tab${openedCount !== 1 ? 's' : ''}` +
                (failedCount > 0 ? ` (${failedCount} couldn't be opened)` : '');
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
                vscode.window.showInformationMessage('No saved tab sets found. Create one first by saving your open tabs!');
                return;
            }

            // Sort by updated date
            allTabSets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = allTabSets.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Which tab set would you like to rename? (${allTabSets.length} available)`
            });

            if (!selected) {
                return;
            }

            const newName = await vscode.window.showInputBox({
                prompt: `Enter a new name for "${selected.tabSet.name}"`,
                placeHolder: 'New tab set name',
                value: selected.tabSet.name,
                validateInput: (value) => {
                    return value && value.trim() ? null : 'Name cannot be empty';
                }
            });

            if (!newName) {
                return;
            }

            const success = storage.renameTabSet(selected.tabSet.id, newName);

            if (success) {
                vscode.window.showInformationMessage(`✓ Renamed to "${newName}"`);
            } else {
                vscode.window.showErrorMessage('Failed to rename tab set. Please try again.');
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
                vscode.window.showInformationMessage('No saved tab sets found. Nothing to delete!');
                return;
            }

            // Sort by updated date
            allTabSets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = allTabSets.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Which tab set would you like to delete? (${allTabSets.length} available)`
            });

            if (!selected) {
                return;
            }

            // Confirm deletion
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete "${selected.tabSet.name}"? This cannot be undone.`,
                { modal: true },
                'Delete',
                'Cancel'
            );

            if (confirm !== 'Delete') {
                return;
            }

            const success = storage.deleteTabSet(selected.tabSet.id);

            if (success) {
                vscode.window.showInformationMessage(`✓ Deleted "${selected.tabSet.name}"`);
            } else {
                vscode.window.showErrorMessage('Failed to delete tab set. Please try again.');
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
                vscode.window.showInformationMessage('No saved tab sets found. Create one first by saving your open tabs!');
                return;
            }

            // Sort by updated date
            allTabSets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = allTabSets.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Which tab set would you like to mark as favorite? (${allTabSets.length} available)`
            });

            if (!selected) {
                return;
            }

            const isFavorite = storage.toggleFavorite(selected.tabSet.id);

            const message = isFavorite
                ? `⭐ Added "${selected.tabSet.name}" to favorites for quick access`
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
                vscode.window.showInformationMessage('No favorite tab sets yet. Mark a tab set as favorite for quick access!');
                return;
            }

            // Sort by updated date
            favorites.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            // Show quick pick
            const items = favorites.map(formatTabSetForQuickPick);
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `⭐ Select a favorite to open (${favorites.length} favorites)`
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

            const message = `Opened ${openedCount} tab${openedCount !== 1 ? 's' : ''} from "${tabSet.name}"` +
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
