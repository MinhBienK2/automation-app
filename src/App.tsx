import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [bridgeStatus, setBridgeStatus] = useState("checking");

  useEffect(() => {
    invoke<string>("ping")
      .then((message) => setBridgeStatus(message))
      .catch(() => setBridgeStatus("error"));
  }, []);

  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">Workflow Automation Manager</p>
        <h1>Rust desktop shell is ready.</h1>
        <p>
          Plan 01 scaffold is running with a React frontend and Tauri command
          bridge.
        </p>
      </section>

      <section className="status-panel" aria-label="Bridge status">
        <span>Rust bridge</span>
        <strong>{bridgeStatus}</strong>
      </section>
    </main>
  );
}

export default App;
