import readline from "node:readline";

const capabilities = {
  protocolVersion: 1,
  ok: true,
  capabilities: {
    actions: ["navigate", "click", "fill", "wait", "take_screenshot", "extract_text"],
    transport: "stdio-jsonl",
    browserEngine: "cloakbrowser",
  },
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

send({
  type: "runner.ready",
  ok: true,
  payload: {
    protocolVersion: 1,
  },
});

const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Number.POSITIVE_INFINITY,
});

lines.on("line", (line) => {
  if (!line.trim()) return;

  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    send({ ok: false, error: "Malformed JSON request." });
    return;
  }

  if (message.type === "healthCheck") {
    send({ id: message.id, ok: true, payload: capabilities });
    return;
  }

  if (message.type === "shutdown") {
    send({ id: message.id, ok: true, payload: { ok: true } });
    process.exit(0);
  }

  send({
    id: message.id,
    ok: false,
    error: `Unsupported runner command '${message.type}'.`,
  });
});
