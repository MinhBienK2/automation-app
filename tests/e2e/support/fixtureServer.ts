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
    if (url.pathname === "/recorder-replay") {
      respondHtml(response, recorderReplayPage(url.searchParams.get("record") === "1"));
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
    if (url.pathname === "/lazy-scroll") {
      respondHtml(response, lazyScrollPage());
      return;
    }
    if (url.pathname === "/human-behavior") {
      respondHtml(response, humanBehaviorPage());
      return;
    }
    if (url.pathname === "/history-a") {
      respondHtml(response, historyPage("a"));
      return;
    }
    if (url.pathname === "/history-b") {
      respondHtml(response, historyPage("b"));
      return;
    }
    if (url.pathname === "/reload") {
      respondHtml(response, reloadPage());
      return;
    }
    if (url.pathname === "/tab-home") {
      respondHtml(response, tabPage("home"));
      return;
    }
    if (url.pathname === "/tab-a") {
      respondHtml(response, tabPage("a"));
      return;
    }
    if (url.pathname === "/tab-b") {
      respondHtml(response, tabPage("b"));
      return;
    }
    if (url.pathname === "/extended-form") {
      respondHtml(response, extendedFormPage());
      return;
    }
    if (url.pathname === "/wait-assertion" || url.pathname === "/wait-assertion-ready") {
      respondHtml(response, waitAssertionPage());
      return;
    }
    if (url.pathname === "/context-storage") {
      respondHtml(response, contextStoragePage());
      return;
    }
    if (url.pathname === "/headers") {
      respondHtml(response, headersPage(request.headers["x-e2e-context"]));
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
      <label>Plan code
        <select data-testid="plan-code" name="planCode">
          <option value="starter">Starter</option>
          <option value="pro">Professional</option>
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
          'planCode=' + data.get('planCode'),
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

function recorderReplayPage(record: boolean) {
  return `<!doctype html>
<html>
  <head><title>Recorder replay fixture</title></head>
  <body>
    <form data-testid="recorder-form">
      <label>Email <input data-testid="email" name="email" value=""></label>
      <label>Paste <input data-testid="paste-target" name="pasteTarget" value=""></label>
      <label>Plan
        <select data-testid="plan" name="plan">
          <option>Free</option>
          <option>Team</option>
        </select>
      </label>
      <label><input data-testid="agree" type="checkbox" name="agree"> Agree</label>
      <button data-testid="submit" type="submit">Submit</button>
    </form>
    <div data-testid="status">idle</div>
    <div data-testid="summary"></div>
    <script>
      const form = document.querySelector('[data-testid="recorder-form"]');
      const summary = document.querySelector('[data-testid="summary"]');
      const status = document.querySelector('[data-testid="status"]');
      const email = document.querySelector('[data-testid="email"]');
      const pasteTarget = document.querySelector('[data-testid="paste-target"]');
      const plan = document.querySelector('[data-testid="plan"]');
      const agree = document.querySelector('[data-testid="agree"]');
      const submit = document.querySelector('[data-testid="submit"]');
      function renderSummary(nextStatus) {
        const data = new FormData(form);
        summary.textContent = [
          'email=' + data.get('email'),
          'paste=' + data.get('pasteTarget'),
          'plan=' + data.get('plan'),
          'agree=' + agree.checked,
          'status=' + nextStatus,
        ].join('|');
      }
      form.addEventListener('input', () => renderSummary('editing'));
      form.addEventListener('change', () => renderSummary('editing'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        status.textContent = 'submitted';
        renderSummary('submitted');
      });
      renderSummary('idle');
      if (${JSON.stringify(record)}) {
        window.setTimeout(() => {
          email.value = 'qa-recorder@example.test';
          email.dispatchEvent(new Event('input', { bubbles: true }));
          pasteTarget.focus();
          const clipboardData = new DataTransfer();
          clipboardData.setData('text/plain', 'clipboard-recorded');
          pasteTarget.dispatchEvent(new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData,
          }));
          pasteTarget.value = 'clipboard-recorded';
          pasteTarget.dispatchEvent(new Event('input', { bubbles: true }));
          plan.value = 'Team';
          plan.dispatchEvent(new Event('change', { bubbles: true }));
          agree.checked = true;
          agree.dispatchEvent(new Event('change', { bubbles: true }));
          submit.click();
        }, 700);
      }
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
    <table data-testid="capture-table">
      <thead>
        <tr><th>Name</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr><td>Fixture</td><td>Ready</td></tr>
      </tbody>
    </table>
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
      button, [draggable] {
        display: block;
        font-size: 16px;
        margin: 18px 8px;
        min-height: 56px;
        min-width: 260px;
        padding: 14px 18px;
      }
      #drop-zone { align-items: center; border: 2px dashed #667085; display: flex; height: 128px; margin: 18px 8px; width: 320px; }
      [data-testid="pointer-summary"] { background: white; border: 1px solid #d0d5dd; margin: 8px; padding: 8px; }
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
    <div style="margin-top: 900px" data-testid="into-view-target">Into view target</div>
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

function lazyScrollPage() {
  return `<!doctype html>
<html>
  <head>
    <title>Lazy Scroll Fixture</title>
    <style>
      body { font-family: sans-serif; margin: 0; min-height: 1800px; padding: 24px; }
      [data-testid="lazy-summary"] {
        background: white;
        border: 1px solid #d0d5dd;
        margin-bottom: 900px;
        padding: 10px;
        position: sticky;
        top: 0;
      }
      [data-testid="lazy-target"] {
        border: 1px solid #667085;
        margin-top: 700px;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <div data-testid="lazy-summary">lazy:idle|scroll:0</div>
    <script>
      const summary = document.querySelector('[data-testid="lazy-summary"]');
      let mounted = false;
      function render() {
        summary.textContent = 'lazy:' + (mounted ? 'mounted' : 'idle') + '|scroll:' + Math.round(window.scrollY);
      }
      window.addEventListener('scroll', () => {
        if (!mounted && window.scrollY > 400) {
          mounted = true;
          const target = document.createElement('div');
          target.dataset.testid = 'lazy-target';
          target.textContent = 'Lazy target mounted after page scroll';
          document.body.appendChild(target);
        }
        render();
      });
      render();
    </script>
  </body>
</html>`;
}

function humanBehaviorPage() {
  return `<!doctype html>
<html>
  <head>
    <title>Human Behavior Fixture</title>
    <style>
      body { font-family: sans-serif; margin: 0; min-height: 1800px; padding: 24px; }
      button, input {
        display: block;
        font-size: 16px;
        margin: 22px 0;
        min-height: 52px;
        min-width: 260px;
        padding: 12px 16px;
      }
      input { box-sizing: border-box; width: 320px; }
      [data-testid="human-summary"] {
        background: #fff;
        border: 1px solid #d0d5dd;
        font-size: 12px;
        margin-bottom: 20px;
        padding: 10px;
        white-space: pre-wrap;
      }
      [data-testid="scroll-marker"] { margin-top: 720px; }
    </style>
  </head>
  <body>
    <pre data-testid="human-summary">{}</pre>
    <button data-testid="human-hover" type="button">Human hover target</button>
    <button data-testid="human-click" type="button">Human click target</button>
    <button data-testid="human-double-click" type="button">Human double click target</button>
    <button data-testid="human-right-click" type="button">Human right click target</button>
    <label>Human input <input data-testid="human-input" value=""></label>
    <label>Human type sequence <input data-testid="human-type-sequence" value=""></label>
    <div data-testid="scroll-marker">Scroll marker</div>
    <script>
      const summary = document.querySelector('[data-testid="human-summary"]');
      const humanInput = document.querySelector('[data-testid="human-input"]');
      const humanTypeSequence = document.querySelector('[data-testid="human-type-sequence"]');
      const startedAt = performance.now();
      const metrics = {
        global: {
          mouse_moves: 0,
          pointer_moves: 0,
          untrusted_events: 0,
          duration_ms: 0,
        },
        hover: {
          enter_trusted: false,
          moves_before_enter: 0,
        },
        click: {
          down_trusted: false,
          up_trusted: false,
          click_trusted: false,
          moves_before_down: 0,
        },
        double_click: {
          dblclick_trusted: false,
          click_events: 0,
        },
        right_click: {
          down_button: null,
          up_button: null,
          contextmenu_trusted: false,
        },
        input: {
          value: '',
          trusted_keydowns: 0,
          trusted_inputs: 0,
        },
        type_sequence: {
          value: '',
          trusted_keydowns: 0,
          trusted_inputs: 0,
        },
        scroll: {
          trusted_wheels: 0,
          scroll_events: 0,
          max_scroll_y: 0,
        },
      };

      function recordTrust(event) {
        if (!event.isTrusted) metrics.global.untrusted_events += 1;
      }

      function render() {
        metrics.global.duration_ms = Math.round(performance.now() - startedAt);
        metrics.input.value = humanInput.value;
        metrics.type_sequence.value = humanTypeSequence.value;
        summary.textContent = JSON.stringify(metrics);
      }

      document.addEventListener('mousemove', (event) => {
        recordTrust(event);
        metrics.global.mouse_moves += 1;
        render();
      }, true);
      document.addEventListener('pointermove', (event) => {
        recordTrust(event);
        metrics.global.pointer_moves += 1;
        render();
      }, true);
      document.addEventListener('wheel', (event) => {
        recordTrust(event);
        if (event.isTrusted) metrics.scroll.trusted_wheels += 1;
        render();
      }, { capture: true, passive: true });
      window.addEventListener('scroll', () => {
        metrics.scroll.scroll_events += 1;
        metrics.scroll.max_scroll_y = Math.max(metrics.scroll.max_scroll_y, Math.round(window.scrollY));
        render();
      }, { passive: true });

      document.querySelector('[data-testid="human-hover"]').addEventListener('mouseenter', (event) => {
        recordTrust(event);
        if (metrics.hover.enter_trusted) {
          render();
          return;
        }
        metrics.hover.enter_trusted = event.isTrusted;
        metrics.hover.moves_before_enter = metrics.global.mouse_moves;
        render();
      });

      const clickTarget = document.querySelector('[data-testid="human-click"]');
      clickTarget.addEventListener('mousedown', (event) => {
        recordTrust(event);
        metrics.click.down_trusted = event.isTrusted;
        metrics.click.moves_before_down = metrics.global.mouse_moves;
        render();
      });
      clickTarget.addEventListener('mouseup', (event) => {
        recordTrust(event);
        metrics.click.up_trusted = event.isTrusted;
        render();
      });
      clickTarget.addEventListener('click', (event) => {
        recordTrust(event);
        metrics.click.click_trusted = event.isTrusted;
        render();
      });

      const doubleClickTarget = document.querySelector('[data-testid="human-double-click"]');
      doubleClickTarget.addEventListener('click', (event) => {
        recordTrust(event);
        if (event.isTrusted) metrics.double_click.click_events += 1;
        render();
      });
      doubleClickTarget.addEventListener('dblclick', (event) => {
        recordTrust(event);
        metrics.double_click.dblclick_trusted = event.isTrusted;
        render();
      });

      const rightClickTarget = document.querySelector('[data-testid="human-right-click"]');
      rightClickTarget.addEventListener('mousedown', (event) => {
        recordTrust(event);
        metrics.right_click.down_button = event.button;
        render();
      });
      rightClickTarget.addEventListener('mouseup', (event) => {
        recordTrust(event);
        metrics.right_click.up_button = event.button;
        render();
      });
      rightClickTarget.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        recordTrust(event);
        metrics.right_click.contextmenu_trusted = event.isTrusted;
        render();
      });

      function monitorTextField(element, bucket) {
        element.addEventListener('keydown', (event) => {
          recordTrust(event);
          if (event.isTrusted) metrics[bucket].trusted_keydowns += 1;
          render();
        });
        element.addEventListener('input', (event) => {
          recordTrust(event);
          if (event.isTrusted) metrics[bucket].trusted_inputs += 1;
          render();
        });
      }

      monitorTextField(humanInput, 'input');
      monitorTextField(humanTypeSequence, 'type_sequence');
      render();
    </script>
  </body>
</html>`;
}

function historyPage(marker: "a" | "b") {
  return `<!doctype html>
<html>
  <head><title>History ${marker}</title></head>
  <body>
    <h1 data-testid="history-marker">history:${marker}</h1>
  </body>
</html>`;
}

function reloadPage() {
  return `<!doctype html>
<html>
  <head><title>Reload fixture</title></head>
  <body>
    <h1 data-testid="reload-marker">reload:pending</h1>
    <script>
      const nextCount = Number(window.sessionStorage.getItem('reload-count') || '0') + 1;
      window.sessionStorage.setItem('reload-count', String(nextCount));
      document.querySelector('[data-testid="reload-marker"]').textContent = 'reload:' + nextCount;
    </script>
  </body>
</html>`;
}

function tabPage(marker: "home" | "a" | "b") {
  return `<!doctype html>
<html>
  <head><title>Tab ${marker}</title></head>
  <body>
    <h1 data-testid="tab-marker">tab:${marker}</h1>
    ${marker === "home" ? `<a href="/tab-a" target="_blank" data-testid="open-tab-link">Open Tab A</a>` : ""}
  </body>
</html>`;
}

function extendedFormPage() {
  return `<!doctype html>
<html>
  <head>
    <title>Extended Form Fixture</title>
    <style>
      [hidden] { display: none; }
      [data-testid="rich-editor"] { border: 1px solid #98a2b3; min-height: 48px; padding: 8px; width: 320px; }
    </style>
  </head>
  <body>
    <label>Upload <input data-testid="upload-input" type="file"></label>
    <div data-testid="upload-status">upload:none</div>
    <button data-testid="custom-trigger" type="button">Choose custom option</button>
    <div data-testid="custom-options" hidden>
      <button type="button">Alpha</button>
      <button type="button">Delta</button>
    </div>
    <div data-testid="custom-status">custom:none</div>
    <div data-testid="rich-editor" contenteditable="true"></div>
    <script>
      document.querySelector('[data-testid="upload-input"]').addEventListener('change', (event) => {
        const file = event.target.files[0];
        document.querySelector('[data-testid="upload-status"]').textContent = 'upload:' + (file ? file.name : 'none');
      });
      const options = document.querySelector('[data-testid="custom-options"]');
      document.querySelector('[data-testid="custom-trigger"]').addEventListener('click', () => {
        options.hidden = false;
      });
      options.addEventListener('click', (event) => {
        if (!(event.target instanceof HTMLButtonElement)) return;
        document.querySelector('[data-testid="custom-status"]').textContent = 'custom:' + event.target.textContent;
        options.hidden = true;
      });
    </script>
  </body>
</html>`;
}

function waitAssertionPage() {
  return `<!doctype html>
<html>
  <head><title>Wait Assertion Fixture</title></head>
  <body>
    <h1>Wait Assertion Fixture</h1>
    <div data-testid="async-status">idle</div>
    <div data-testid="hide-me">visible before wait</div>
    <div data-testid="detach-me">attached before wait</div>
    <button data-testid="enable-me" disabled>Enable me</button>
    <button data-testid="disable-me">Disable me</button>
  </body>
</html>`;
}

function contextStoragePage() {
  return `<!doctype html>
<html>
  <head><title>Context Storage Fixture</title></head>
  <body>
    <h1 data-testid="context-marker">context-storage</h1>
  </body>
</html>`;
}

function headersPage(headerValue: string | string[] | undefined) {
  const value = Array.isArray(headerValue) ? headerValue.join(",") : (headerValue ?? "missing");
  return `<!doctype html>
<html>
  <head><title>Headers Fixture</title></head>
  <body>
    <h1 data-testid="header-marker">header:${value}</h1>
  </body>
</html>`;
}
