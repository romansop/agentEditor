import * as vscode from 'vscode';
import { Draw2dDocument } from './draw2dDocument';
import { getNonce } from './getNonce';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'draw2d.editor',
      new Draw2dEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('myExtension.serialize', () => {
      const textEditor = vscode.window.activeTextEditor;
      console.log(textEditor);
      // const webview = vscode.window.activeTextEditor!.webview;
      // webview.postMessage('serialize');
    })
  );
}

class Draw2dEditorProvider implements vscode.CustomEditorProvider<Draw2dDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Draw2dDocument>>();

  public readonly onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<Draw2dDocument>> = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) { }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<Draw2dDocument> {
    return Draw2dDocument.create(uri);
  }

  async resolveCustomEditor(
    document: Draw2dDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const updateWebview = () => {
      console.log("Updating webview with content:", document.content);
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.content,
      });
    };

    const changeDocumentSubscription = document.onDidChangeContent((e) => {
      updateWebview();
      this._onDidChangeCustomDocument.fire({
        document,
        undo: () => {
          document.updateContent(e.content);
        },
        redo: () => {
          document.updateContent(e.content);
        }
      });
      updateWebview();
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      console.log("Message received from webview:", message);
      switch (message.type) {
        case 'save':
          document.updateContent(message.content);
          await document.save();
          break;
        case 'edit':
          this.updateTextDocument(document, message.content);
          this._onDidChangeCustomDocument.fire({
            document,
            label: 'Edit',
            undo: async () => { /* handle undo */ },
            redo: async () => { /* handle redo */ },
          });
          break;
      }
    });

    updateWebview();
  }

  async saveCustomDocument(document: Draw2dDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    await this.saveDocument(document, document.uri);
  }

  async saveCustomDocumentAs(document: Draw2dDocument, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<void> {
    await this.saveDocument(document, destination);
  }

  async revertCustomDocument(document: Draw2dDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    const fileData = await vscode.workspace.fs.readFile(document.uri);
    document.updateContent(fileData.toString());
  }

  async backupCustomDocument(document: Draw2dDocument, context: vscode.CustomDocumentBackupContext, _cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    return this.saveDocument(document, context.destination).then(() => {
      return {
        id: context.destination.toString(),
        delete: () => vscode.workspace.fs.delete(context.destination)
      };
    });
  }

  private async saveDocument(document: Draw2dDocument, uri: vscode.Uri): Promise<void> {
    const content = Buffer.from(document.content, 'utf8');
    await vscode.workspace.fs.writeFile(uri, content);
    this._onDidChangeCustomDocument.fire({
      document,
      undo: () => { /* handle undo */ },
      redo: () => { /* handle redo */ }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Draw2D Editor</title>
  <link href="${styleUri}" rel="stylesheet">
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</head>
<body>
  <div id="canvas" style="width:100%; height:100vh; border:1px solid black;"></div>
</body>
</html>`;
  }

  private async updateTextDocument(document: Draw2dDocument, content: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(document.content.split('\n').length, 0)
    );
    edit.replace(document.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
    document.content = content;
    // await document.save();
  }

}
