# Runtime Stabilization Spec

## Scope

This stabilization pass covers the paths that must work before an operator can
use the desktop app:

- Electron startup, production renderer loading, sandboxed preload, and typed
  workflow bridge exposure.
- Workflow list, workflow creation, graph canvas rendering, action type editing,
  and app-level Settings navigation.
- Workflow Settings dialog navigation, Execution and Browser field editing, and
  settings save through Electron IPC.
- Electron backend command, persistence, graph compiler, and runner test suites.
- Linux unpacked packaging smoke for the production binary.

## Required Behaviors

- The production BrowserWindow keeps `contextIsolation: true`,
  `nodeIntegration: false`, and `sandbox: true`.
- The preload artifact loaded by Electron is CommonJS-compatible
  `preload.cjs`; no sandboxed preload runtime depends on ESM `import`.
- Renderer production assets are emitted with relative paths so `file://`
  loading works from Electron.
- `window.workflowApi` is exposed before React workflow commands run.
- Workflow creation opens the graph workspace and renders the default
  `Start -> New node` graph.
- Action type selection updates the selected graph node editor.
- Workflow Settings can edit and persist Execution and Browser values.
- Desktop runtime smoke must report no page errors and no console errors for
  preload loading, bridge availability, missing renderer assets, syntax errors,
  or missing dialog descriptions.

## Verification Gates

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `npm run electron:pack`
- Direct Electron smoke from source build with a temporary app-data directory.
- Direct smoke of `release/linux-unpacked/workflow-automation-manager`.

## Notes

Electron-builder may still print package metadata and dependency warnings. Those
warnings are non-blocking for this stabilization pass because the unpacked binary
starts, exposes the bridge, and renders the workflow screen without runtime
errors.
