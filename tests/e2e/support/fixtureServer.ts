import http from "node:http";
import type { AddressInfo } from "node:net";

export type FixtureServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/form") {
      respondHtml(response, formPage());
      return;
    }
    if (url.pathname === "/basic") {
      respondHtml(response, basicPage());
      return;
    }
    if (url.pathname === "/capture") {
      respondHtml(response, capturePage());
      return;
    }
    if (url.pathname === "/network") {
      respondHtml(response, networkPage());
      return;
    }
    if (url.pathname === "/keyboard") {
      respondHtml(response, keyboardPage());
      return;
    }
    if (url.pathname === "/dialog") {
      respondHtml(response, dialogPage());
      return;
    }
    if (url.pathname === "/pointer") {
      respondHtml(response, pointerPage());
      return;
    }
    if (url.pathname === "/download/report.csv") {
      response.writeHead(200, {
        "content-disposition": 'attachment; filename="owned-report.csv"',
        "content-type": "text/csv",
      });
      response.end("name,status\nfixture,ready\n");
      return;
    }
    if (url.pathname === "/api/echo") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, query: url.searchParams.get("q") ?? "" }));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function respondHtml(response: http.ServerResponse, body: string) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function basicPage() {
  return `<!doctype html>
<html>
  <head><title>Basic fixture</title></head>
  <body>
    <h1 data-testid="title">Basic Fixture</h1>
    <button data-testid="toggle">Toggle</button>
    <div data-testid="status">idle</div>
    <script>
      document.querySelector('[data-testid="toggle"]').addEventListener('click', () => {
        document.querySelector('[data-testid="status"]').textContent = 'clicked';
      });
    </script>
  </body>
</html>`;
}

function formPage() {
  return `<!doctype html>
<html>
  <head><title>Form fixture</title></head>
  <body>
    <form data-testid="form">
      <label>Email <input data-testid="email" name="email" value=""></label>
      <label>Clear me <input data-testid="clear-me" name="clearMe" value="remove me"></label>
      <label>Plan
        <select data-testid="plan" name="plan">
          <option>Free</option>
          <option>Team</option>
        </select>
      </label>
      <label><input data-testid="agree" type="checkbox" name="agree"> Agree</label>
      <label><input data-testid="newsletter" type="checkbox" name="newsletter" checked> Newsletter</label>
      <label><input data-testid="toggle" type="checkbox" name="toggle"> Toggle</label>
      <label><input data-testid="role-admin" type="radio" name="role" value="admin"> Admin</label>
      <button data-testid="submit" type="submit">Submit</button>
    </form>
    <div data-testid="status">idle</div>
    <div data-testid="summary"></div>
    <script>
      const form = document.querySelector('[data-testid="form"]');
      const summary = document.querySelector('[data-testid="summary"]');
      function renderSummary(status) {
        const data = new FormData(form);
        summary.textContent = [
          'email=' + data.get('email'),
          'clear=' + data.get('clearMe'),
          'plan=' + data.get('plan'),
          'agree=' + document.querySelector('[data-testid="agree"]').checked,
          'newsletter=' + document.querySelector('[data-testid="newsletter"]').checked,
          'toggle=' + document.querySelector('[data-testid="toggle"]').checked,
          'role=' + data.get('role'),
          'status=' + status,
        ].join('|');
      }
      form.addEventListener('input', () => renderSummary('editing'));
      form.addEventListener('change', () => renderSummary('editing'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        document.querySelector('[data-testid="status"]').textContent = 'submitted';
        renderSummary('submitted');
      });
      renderSummary('idle');
    </script>
  </body>
</html>`;
}

function capturePage() {
  return `<!doctype html>
<html>
  <head><title>Capture fixture</title></head>
  <body>
    <h1 data-testid="capture-title" data-status="ready">Capture Fixture</h1>
    <input data-testid="capture-input" value="field-value">
    <ul>
      <li data-testid="capture-item">Alpha</li>
      <li data-testid="capture-item">Beta</li>
      <li data-testid="capture-item">Gamma</li>
    </ul>
    <a data-testid="download-report" href="/download/report.csv" download>Download report</a>
  </body>
</html>`;
}

function networkPage() {
  return `<!doctype html>
<html>
  <head><title>Network Fixture</title></head>
  <body>
    <h1 data-testid="network-title">Network Fixture</h1>
    <div data-testid="network-status">idle</div>
  </body>
</html>`;
}

function keyboardPage() {
  return `<!doctype html>
<html>
  <head><title>Keyboard Fixture</title></head>
  <body>
    <label>Focus <input data-testid="focus-input"></label>
    <label>Paste <input data-testid="paste-input"></label>
    <label>Sequence <input data-testid="sequence-input"></label>
    <div data-testid="keyboard-status">idle</div>
    <script>
      const status = document.querySelector('[data-testid="keyboard-status"]');
      document.querySelector('[data-testid="focus-input"]').addEventListener('focus', () => {
        status.textContent = 'focused';
      });
      document.querySelector('[data-testid="focus-input"]').addEventListener('blur', () => {
        status.textContent = 'blurred';
      });
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          status.textContent = 'hotkey';
        } else if (event.key === 'Enter') {
          status.textContent = 'enter';
        }
      });
    </script>
  </body>
</html>`;
}

function dialogPage() {
  return `<!doctype html>
<html>
  <head><title>Dialog Fixture</title></head>
  <body>
    <button data-testid="prompt-button">Prompt</button>
    <button data-testid="confirm-button">Confirm</button>
    <div data-testid="dialog-status">idle</div>
    <script>
      const status = document.querySelector('[data-testid="dialog-status"]');
      document.querySelector('[data-testid="prompt-button"]').addEventListener('click', () => {
        status.textContent = 'prompt:' + window.prompt('Name');
      });
      document.querySelector('[data-testid="confirm-button"]').addEventListener('click', () => {
        status.textContent = 'confirm:' + window.confirm('Proceed');
      });
    </script>
</body>
</html>`;
}

function pointerPage() {
  return `<!doctype html>
<html>
  <head>
    <title>Pointer Fixture</title>
    <style>
      body { min-height: 1800px; font-family: sans-serif; }
      button, [draggable] { margin: 8px; padding: 8px 12px; }
      #drop-zone { align-items: center; border: 2px dashed #667085; display: flex; height: 96px; margin: 8px; width: 240px; }
      [data-testid="pointer-summary"] { background: white; border: 1px solid #d0d5dd; padding: 8px; position: sticky; top: 0; z-index: 1; }
    </style>
  </head>
  <body>
    <div data-testid="pointer-summary">click:0|double:0|right:0|hover:0|drop:none|scroll:idle</div>
    <button data-testid="click-target">Click target</button>
    <button data-testid="double-click-target">Double click target</button>
    <button data-testid="right-click-target">Right click target</button>
    <button data-testid="hover-target">Hover target</button>
    <div data-testid="drag-source" draggable="true">drag-source</div>
    <div data-testid="drop-zone" id="drop-zone">Drop here</div>
    <script>
      const summary = document.querySelector('[data-testid="pointer-summary"]');
      const state = { click: 0, double: 0, right: 0, hover: 0, drop: 'none', scroll: 'idle' };
      function render() {
        summary.textContent = [
          'click:' + state.click,
          'double:' + state.double,
          'right:' + state.right,
          'hover:' + state.hover,
          'drop:' + state.drop,
          'scroll:' + state.scroll,
        ].join('|');
      }
      document.querySelector('[data-testid="click-target"]').addEventListener('click', () => {
        state.click += 1;
        render();
      });
      document.querySelector('[data-testid="double-click-target"]').addEventListener('dblclick', () => {
        state.double += 1;
        render();
      });
      const rightClickTarget = document.querySelector('[data-testid="right-click-target"]');
      function markRightClick(event) {
        event.preventDefault();
        if ((event.button === 2 || event.buttons === 2 || event.type === 'contextmenu') && state.right === 0) {
          state.right += 1;
          render();
        }
      }
      rightClickTarget.addEventListener('pointerdown', markRightClick);
      rightClickTarget.addEventListener('pointerup', markRightClick);
      rightClickTarget.addEventListener('mousedown', markRightClick);
      rightClickTarget.addEventListener('mouseup', markRightClick);
      rightClickTarget.addEventListener('auxclick', markRightClick);
      rightClickTarget.addEventListener('contextmenu', markRightClick);
      document.querySelector('[data-testid="hover-target"]').addEventListener('mouseenter', () => {
        state.hover = 1;
        render();
      });
      document.querySelector('[data-testid="drag-source"]').addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', 'drag-source');
      });
      document.querySelector('[data-testid="drop-zone"]').addEventListener('dragover', (event) => {
        event.preventDefault();
      });
      document.querySelector('[data-testid="drop-zone"]').addEventListener('drop', (event) => {
        event.preventDefault();
        state.drop = event.dataTransfer.getData('text/plain');
        render();
      });
      window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
          state.scroll = 'scrolled';
          render();
        }
      });
    </script>
  </body>
</html>`;
}
