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
