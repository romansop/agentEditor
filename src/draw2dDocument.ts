import * as vscode from 'vscode';

export class Draw2dDocument implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private _content: string;
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  private readonly _onDidChangeContent = new vscode.EventEmitter<{
    readonly content: string;
  }>();

  public static async create(
    uri: vscode.Uri
  ): Promise<Draw2dDocument | PromiseLike<Draw2dDocument>> {
    const fileData = await vscode.workspace.fs.readFile(uri);
    const document = new Draw2dDocument(uri, fileData.toString());
    return document;
  }

  private constructor(uri: vscode.Uri, initialContent: string) {
    this._uri = uri;
    this._content = initialContent;
    console.log("Document created with content:", this._content);
  }

  public get uri() {
    return this._uri;
  }

  public get content() {
    return this._content;
  }

  public dispose(): void {
    this._onDidDispose.fire();
  }

  public get onDidDispose(): vscode.Event<void> {
    return this._onDidDispose.event;
  }

  public get onDidChangeContent(): vscode.Event<{ readonly content: string }> {
    return this._onDidChangeContent.event;
  }

  public updateContent(newContent: string): void {
    this._content = newContent;
    console.log("Document content updated:", this._content);
    this._onDidChangeContent.fire({ content: this._content });
  }

  public async save(): Promise<void> {
    console.log("Saving document:", this._content);
    await vscode.workspace.fs.writeFile(this.uri, Buffer.from(this._content));
  }
}
