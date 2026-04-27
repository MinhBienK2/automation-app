import type { RunState } from "../../../types/workflow";

type RunStatusBarProps = {
  state: RunState;
  error: string;
};

export function RunStatusBar({ state, error }: RunStatusBarProps) {
  const failure =
    state.status === "failed" && state.error
      ? `Failed at step ${state.error.step_number}: ${state.error.reason}`
      : "";

  return (
    <div className="run-status">
      <span>Status</span>
      <strong>{state.status}</strong>
      {failure ? <p>{failure}</p> : null}
      {error ? <p>{error}</p> : null}
    </div>
  );
}
