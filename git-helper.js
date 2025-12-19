const { exec } = require('child_process');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Git helper module for branch detection and operations
 */
class GitHelper {
    /**
     * Get the current git branch name
     */
    async getCurrentBranch(workspaceFolder) {
        if (!workspaceFolder) {
            return null;
        }

        try {
            const { stdout, stderr } = await execPromise('git rev-parse --abbrev-ref HEAD', {
                cwd: workspaceFolder
            });

            if (stderr) {
                console.error('Git error:', stderr);
                return null;
            }

            return stdout.trim();
        } catch (error) {
            // Not a git repository or git not available
            console.log('Not a git repository or git not available:', error.message);
            return null;
        }
    }

    /**
     * Check if the current workspace is a git repository
     */
    async isGitRepository(workspaceFolder) {
        if (!workspaceFolder) {
            return false;
        }

        try {
            const { stderr } = await execPromise('git rev-parse --git-dir', {
                cwd: workspaceFolder
            });

            return !stderr;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get git status
     */
    async getStatus(workspaceFolder) {
        if (!workspaceFolder) {
            return null;
        }

        try {
            const { stdout } = await execPromise('git status --short', {
                cwd: workspaceFolder
            });

            return stdout.trim();
        } catch (error) {
            return null;
        }
    }
}

module.exports = new GitHelper();
