// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
let vscode = require('vscode');
let savedSet = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Tab Hero is now active! Let\'s save those tabs!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let saveTabSet = vscode.commands.registerCommand('extension.saveTabSet', function () {
        savedSet = vscode.workspace.textDocuments.filter(item => !item.isUntitled);
        vscode.window.showInformationMessage('Tabs Saved! : ' + savedSet.length);
    });

    let openTabSet = vscode.commands.registerCommand('extension.openTabSet', function () {
        vscode.window.showInformationMessage('Tabs to Open: ' + savedSet.length);
        savedSet.forEach((tab) => {
            vscode.workspace.openTextDocument(tab.uri)
            .then(doc => vscode.window.showTextDocument(doc))
            // .catch(err => console.log(err))
        });
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
        console.log('Document opened: ', document);
        console.log('Current documents:', vscode.workspace.textDocuments);
    });

    context.subscriptions.push(saveTabSet, openTabSet);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;