let vscode = require('vscode');
let savedSet = [];

function activate(context) {

    console.log('Tab Hero is now active! Let\'s save those tabs!');

    let saveTabSet = vscode.commands.registerCommand('extension.saveTabSet', function () {
        savedSet = vscode.workspace.textDocuments.filter(item => !item.isUntitled);
        vscode.window.showInformationMessage('Tabs Saved! : ' + savedSet.length);
    });

    let openTabSet = vscode.commands.registerCommand('extension.openTabSet', function () {
        vscode.window.showInformationMessage('Tabs to Open: ' + savedSet.length);
        savedSet.forEach((tab) => {
            vscode.workspace.openTextDocument(tab.uri)
            .then(doc => vscode.window.showTextDocument(doc))
        });
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
        console.log('Document opened: ', document);
        console.log('Current documents:', vscode.workspace.textDocuments);
    });

    context.subscriptions.push(saveTabSet, openTabSet);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;
