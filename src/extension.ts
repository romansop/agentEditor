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
}

class Draw2dEditorProvider implements vscode.CustomEditorProvider<Draw2dDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Draw2dDocument>>();

  public readonly onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<Draw2dDocument>> = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

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

    const changeDocumentSubscription = document.onDidChangeContent(() => {
      updateWebview();
      this._onDidChangeCustomDocument.fire({
        document,
        label: 'Edit',
        undo: async () => { /* handle undo */ },
        redo: async () => { /* handle redo */ },
      });
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
      }
    });

    updateWebview();
  }

  async saveCustomDocument(document: Draw2dDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    await document.save();
  }

  async saveCustomDocumentAs(document: Draw2dDocument, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<void> {
    const newContent = document.content;
    await vscode.workspace.fs.writeFile(destination, Buffer.from(newContent));
  }

  async revertCustomDocument(document: Draw2dDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    const fileData = await vscode.workspace.fs.readFile(document.uri);
    document.updateContent(fileData.toString());
  }

  async backupCustomDocument(document: Draw2dDocument, context: vscode.CustomDocumentBackupContext, _cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    const backupUri = context.destination;
    await this.saveCustomDocumentAs(document, backupUri, _cancellation);
    return {
      id: backupUri.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(backupUri);
        } catch {
          // No-op if the file does not exist
        }
      },
    };
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
  <script nonce="${nonce}" src="${scriptUri}"></script>
</head>
<body>
  <div id="canvas" style="width:100%; height:100vh; border:1px solid black;"></div>
</body>
</html>`;
  }
}
