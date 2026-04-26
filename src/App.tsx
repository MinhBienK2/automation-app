import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type WorkflowSummary = {
  id: string;
  name: string;
  step_count: number;
};

function App() {
  const [bridgeStatus, setBridgeStatus] = useState("checking");
  const [workflowStatus, setWorkflowStatus] = useState("loading");

  useEffect(() => {
    invoke<string>("ping")
      .then((message) => setBridgeStatus(message))
      .catch(() => setBridgeStatus("error"));

    invoke<WorkflowSummary[]>("list_workflows")
      .then((workflows) => setWorkflowStatus(`${workflows.length} saved`))
      .catch(() => setWorkflowStatus("error"));
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

      <section className="status-panel" aria-label="Workflow command status">
        <span>Workflow command</span>
        <strong>{workflowStatus}</strong>
      </section>
    </main>
  );
}

export default App;
