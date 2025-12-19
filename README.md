# Tab Hero

Tab Hero allows you to save and restore sets of open tabs in VS Code and Cursor. Perfect for switching between git branches, managing different feature contexts, or organizing your workflow with saved favorites.

## Features

### Save & Restore Tab Sets
- **Save your current tabs** with custom names
- **Restore tab sets** from a searchable list
- **Persistent storage** - tab sets survive VS Code restarts
- **Git branch awareness** - automatically associates tab sets with your current branch

### Favorites
- **Mark tab sets as favorites** for quick access
- **Browse favorites** separately from other tab sets
- Favorites appear first in tab set lists with a ⭐ indicator

### Branch Integration
- **Auto-detect git branch** when saving tabs
- **Restore branch tabs** - quickly restore the most recent tab set for your current branch
- Perfect for switching between feature branches

### Management
- **Rename tab sets** after creation
- **Delete unused tab sets** with confirmation
- **Toggle favorites** on/off for any tab set

## Commands

Access all commands via Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`):

- **Tab Hero: Save Tab Set** - Save your currently open tabs
- **Tab Hero: Open Tab Set** - Browse and restore any saved tab set
- **Tab Hero: Restore Branch Tabs** - Restore the most recent tab set for the current git branch
- **Tab Hero: Open Favorites** - Browse and restore favorite tab sets
- **Tab Hero: Rename Tab Set** - Rename an existing tab set
- **Tab Hero: Delete Tab Set** - Delete a tab set (with confirmation)
- **Tab Hero: Toggle Favorite** - Mark or unmark a tab set as favorite

## Usage Examples

### Scenario 1: Working with Git Branches
```
1. Working on feature branch with specific files open
2. Run "Tab Hero: Save Tab Set" - name it "Feature X work"
3. Switch to main branch: `git checkout main`
4. Run "Tab Hero: Restore Branch Tabs" - opens your last saved tabs for main
5. Switch back: `git checkout feature-x`
6. Run "Tab Hero: Restore Branch Tabs" - instantly restores Feature X files
```

### Scenario 2: Favorite Workflows
```
1. Open files you frequently work with together
2. Run "Tab Hero: Save Tab Set" - name it "API Development"
3. Mark as favorite: Yes
4. Later, quickly access with "Tab Hero: Open Favorites"
```

## Storage

Tab sets are stored in `.vscode/tab-hero.json` in your workspace folder. This file is automatically created and managed by the extension. You can commit this file to share tab sets with your team, or add it to `.gitignore` to keep it personal.

## Compatibility

Tab Hero is compatible with:
- **VS Code** - Full support
- **Cursor** - Full support (uses standard VS Code extension APIs)

## Release Notes

### 1.0.0

Complete rewrite with new features:
- ✅ Persistent storage in `.vscode/tab-hero.json`
- ✅ Git branch detection and association
- ✅ Named tab sets with custom names
- ✅ Favorites system
- ✅ Rename and delete operations
- ✅ Quick pick UI for browsing tab sets
- ✅ Improved tab detection (captures all open tabs)
- ✅ Cursor IDE compatibility

### 0.0.1

Initial release of Tab Hero (Beta)

## Known Issues

None currently reported. Please report issues on GitHub.
