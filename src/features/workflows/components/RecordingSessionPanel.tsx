import { Square, Trash2 } from "lucide-react";
import { KeyValueList } from "../../../components/patterns/KeyValueList";
import { StatusCluster } from "../../../components/patterns/StatusCluster";
import { Button } from "../../../components/ui/button";
import { DialogFooter } from "../../../components/ui/dialog";
import type { RecordingSession } from "../../../types/workflow";
import {
  formatRecordingDuration,
  formatRecordingStartedAt,
} from "../lib/recordingReview";

type RecordingSessionPanelProps = {
  session: RecordingSession | null;
  busy: boolean;
  error: string;
  onStopRecording: () => void;
  onRequestDiscard: () => void;
};

export function RecordingSessionPanel({
  session,
  busy,
  error,
  onStopRecording,
  onRequestDiscard,
}: RecordingSessionPanelProps) {
  const identity = session?.browser_identity;
  const eventCount = session?.event_count ?? 0;

  return (
    <div className="recording-session-panel">
      <div className="recording-live-header">
        <StatusCluster
          ariaLabel="Recording status"
          items={[
            {
              label: session?.status ?? "recording",
              tone: session?.status === "failed" ? "danger" : "active",
            },
            { label: `${eventCount} ${eventCount === 1 ? "event" : "events"}`, tone: "neutral" },
            { label: formatRecordingDuration(session), tone: "muted" },
          ]}
        />
        <p>{formatRecordingStartedAt(session)}</p>
      </div>

      <KeyValueList
        items={[
          { label: "Current page", value: session?.page_url ?? "No page URL yet", monospace: true },
          { label: "Identity", value: identity?.display_name ?? "Recording identity" },
          { label: "Persona label", value: identity?.persona_label ?? "Default persona" },
          { label: "Interaction", value: identity?.humanize ? "Humanize on" : "Humanize off" },
          { label: "Human preset", value: identity?.human_preset ?? "default" },
          { label: "Browser", value: identity?.headless ? "Headless" : "Headed" },
        ]}
      />

      {session?.warnings.length ? (
        <ul className="recording-warning-list">
          {session.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="field-error">{error}</p> : null}

      <DialogFooter className="form-actions recording-review-actions">
        <Button
          shape="pill"
          type="button"
          disabled={busy}
          onClick={onStopRecording}
        >
          <Square aria-hidden="true" />
          Stop Recording
        </Button>
        <Button
          variant="secondary"
          type="button"
          disabled={busy}
          onClick={onRequestDiscard}
        >
          <Trash2 aria-hidden="true" />
          Discard
        </Button>
      </DialogFooter>
    </div>
  );
}
