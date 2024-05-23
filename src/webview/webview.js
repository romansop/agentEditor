// import { provideVSCodeDesignSystem, vsCodeDataGrid, vsCodeDataGridCell, vsCodeDataGridRow, vsCodeButton } from '@vscode/webview-ui-toolkit';
import "./import-jquery";
import "jquery-ui-bundle";
import "jquery-ui-bundle/jquery-ui.css";
import draw2d from 'draw2d';

const vscode = acquireVsCodeApi();
const canvas = new draw2d.Canvas("canvas");

function adjustCanvasSize() {
  const canvasContainer = document.getElementsByTagName("html")[0];
  canvas.setDimension(canvasContainer.clientWidth-2, canvasContainer.clientHeight-2);
}

function createNode(name, x, y) {
  let rect = new draw2d.shape.basic.Rectangle({ width: 100, height: 50 });
  rect.createPort("input", new draw2d.layout.locator.LeftLocator());
  rect.createPort("input", new draw2d.layout.locator.RightLocator());
  rect.createPort("output", new draw2d.layout.locator.LeftLocator());
  rect.createPort("output", new draw2d.layout.locator.RightLocator());
  rect.setUserData({ name: name });
  rect.setPosition(x, y);  
  canvas.add(rect);
  rect.on("move", function() {
    postEditMessage(rect);
  });
  return rect;
}

// Notify the extension that the webview is loaded
window.addEventListener('load', () => {
  document.getElementById('loader').classList.add('hidden');
  document.getElementById('canvas').style.display = 'block';
  vscode.postMessage({ type: 'webviewLoaded' });
});

window.addEventListener('resize', adjustCanvasSize);

window.addEventListener('message', event => {
  const message = event.data;
  switch (message.type) {
    case 'update':
      const nodes = JSON.parse(message.text);
      canvas.clear();
      nodes.forEach(node => {
        createNode(node.name, node.x, node.y);
      });
      break;
    case 'serialize':
      serialize();
      break;
    default:
      console.log('Event received: '+message);
      break;
  }
});

function serialize() {
  const nodes = [];
  canvas.getFigures().each((i, figure) => {
    nodes.push({
      name: figure.getUserData().name,
      x: figure.getX(),
      y: figure.getY(),
    });
  });
  return JSON.stringify(nodes, null, 2);
}

window.addEventListener('beforeunload', () => {
  vscode.postMessage({
    type: 'save',
    content: serialize(),
  });
});

let debounceTimer;

function postEditMessage(rect) {
  // Clear the existing timer if the function is called again before the timer executes
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set a new timer
  debounceTimer = setTimeout(() => {
    console.log("Rectangle position changed to: ", rect.getPosition());
    vscode.postMessage({
      type: 'edit',
      content: serialize()
    });
  }, 1000);
}

canvas.on('select', function(emitter, event) {
  console.log("Figure selected: ", emitter);
});