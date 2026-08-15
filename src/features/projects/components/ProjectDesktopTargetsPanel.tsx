import { useMemo, useState } from "react";
import { Monitor, Plus, Trash2 } from "lucide-react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import type {
  CapabilityTier,
  DesktopTarget,
  DesktopTargetInput,
  Project,
} from "../../../types/workflow";

/**
 * Desktop Targets for a project.
 *
 * A sibling of the Browser Profiles panel, and a separate tab rather than more
 * rows in that one. The two look alike from a distance — both are "the thing a
 * workflow runs against" — but a Browser Profile owns a user-data directory and
 * a fingerprint identity, while a Desktop Target owns no storage at all and
 * names an application the operator already has installed. Merged, every row
 * would leave half the columns blank.
 *
 * Spec: `docs/domain/desktop/desktop-target.md`.
 */

type ProjectDesktopTargetsPanelProps = {
  project: Project | null;
  desktopTargets: DesktopTarget[];
  error: string;
  onCreateDesktopTarget: (projectId: string, input: DesktopTargetInput) => Promise<void>;
  onDeleteDesktopTarget: (targetId: string) => Promise<void>;
};

/**
 * What the operator can expect of a window, in their words.
 *
 * Shown from the last run rather than probed here: the tier is a property of
 * the individual window and is re-read every run, so a value from an authoring
 * screen would be a guess. Absent until a run has looked.
 */
const TIER_COPY: Record<CapabilityTier, { label: string; detail: string; tone: string }> = {
  element: {
    label: "Element",
    detail: "Controls are addressable by name — the durable kind of step.",
    tone: "text-success",
  },
  chrome: {
    label: "Window only",
    detail: "Only the frame answered. Nothing inside the window is addressable.",
    tone: "text-warning",
  },
  pixel: {
    label: "Pixel",
    detail: "No accessibility tree. Steps break when the window moves or resizes.",
    tone: "text-error",
  },
};

export function ProjectDesktopTargetsPanel({
  project,
  desktopTargets,
  error,
  onCreateDesktopTarget,
  onDeleteDesktopTarget,
}: ProjectDesktopTargetsPanelProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [launchKind, setLaunchKind] = useState<"app_id" | "executable">("app_id");
  const [launchValue, setLaunchValue] = useState("");
  const [windowTitle, setWindowTitle] = useState("");

  const targets = useMemo(
    () => desktopTargets.filter((target) => !project || target.project_id === project.id),
    [desktopTargets, project],
  );

  function resetForm() {
    setName("");
    setLaunchKind("app_id");
    setLaunchValue("");
    setWindowTitle("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    setBusy(true);
    try {
      await onCreateDesktopTarget(project.id, {
        name: name.trim(),
        launch: { kind: launchKind, value: launchValue.trim() },
        // An empty title means "any window of this process", which is right for
        // a single-window application and wrong the moment a dialog opens. The
        // launch failure names what it found, so this stays optional.
        window: windowTitle.trim()
          ? { title: { kind: "prefix", value: windowTitle.trim() } }
          : {},
      });
      setCreateOpen(false);
      resetForm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-fg-primary">Desktop Targets</h2>
          <p className="text-xs text-fg-muted max-w-prose">
            An application a desktop workflow drives. A Target owns no storage — the application
            keeps its own state, shared with your use of it, so launching is not a clean slate.
          </p>
        </div>
        <Button
          className="btn-primary"
          disabled={!project}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          New Desktop Target
        </Button>
      </header>

      {error ? <Alert variant="error" className="text-xs p-2.5">{error}</Alert> : null}

      {targets.length === 0 ? (
        <Alert variant="info" className="text-xs p-2.5">
          No Desktop Targets yet. Add one to give a desktop workflow an application to drive.
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Launches</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Last observed tier</TableHead>
              <TableHead aria-label="Actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((target) => {
              const tier = target.observed_tier ? TIER_COPY[target.observed_tier] : null;
              return (
                <TableRow key={target.id}>
                  <TableCell className="font-medium text-fg-primary">
                    <span className="inline-flex items-center gap-2">
                      <Monitor className="size-4 text-fg-muted" aria-hidden />
                      {target.name}
                      {target.is_default ? (
                        <span className="text-[11px] text-fg-muted">Default</span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{target.launch.value}</TableCell>
                  <TableCell className="text-xs text-fg-secondary">
                    {target.window.title
                      ? `${target.window.title.kind} “${target.window.title.value}”`
                      : "Any window of the process"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {tier ? (
                      <span className={tier.tone} title={tier.detail}>
                        {tier.label}
                      </span>
                    ) : (
                      <span className="text-fg-muted">Not measured yet</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <IconButton
                      label={`Delete ${target.name}`}
                      tooltip={`Delete ${target.name}`}
                      onClick={() => void onDeleteDesktopTarget(target.id)}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <p className="eyebrow">Desktop</p>
            <DialogTitle>New Desktop Target</DialogTitle>
            <DialogDescription>
              Name the application, and how to recognise its window.
            </DialogDescription>
          </DialogHeader>

          <form className="flex flex-col gap-4 mt-2" onSubmit={submit}>
            <FormField label="Name" htmlFor="desktop-target-name">
              <Input
                autoFocus
                id="desktop-target-name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Ledger"
                className="input-sm border-base-300 w-full"
              />
            </FormField>

            <FormField label="Launch by" htmlFor="desktop-target-kind">
              <Select
                id="desktop-target-kind"
                value={launchKind}
                onChange={(event) =>
                  setLaunchKind(event.currentTarget.value === "executable" ? "executable" : "app_id")
                }
                className="select-sm bg-base-100 border-base-300 w-full"
              >
                <option value="app_id">Application id</option>
                <option value="executable">Path to an executable</option>
              </Select>
            </FormField>

            <FormField
              label={launchKind === "app_id" ? "Application id" : "Executable path"}
              htmlFor="desktop-target-value"
              description="Not checked here — a wrong value fails at launch, where the error can name the application."
            >
              <Input
                id="desktop-target-value"
                value={launchValue}
                onChange={(event) => setLaunchValue(event.currentTarget.value)}
                placeholder={launchKind === "app_id" ? "notepad" : "C:\\Tools\\ledger.exe"}
                className="input-sm border-base-300 w-full font-mono"
              />
            </FormField>

            <FormField
              label="Window title starts with"
              htmlFor="desktop-target-window"
              description="Optional. Leave empty to bind any window of the process — fine until the application opens a second one, when the run fails and lists what it found."
            >
              <Input
                id="desktop-target-window"
                value={windowTitle}
                onChange={(event) => setWindowTitle(event.currentTarget.value)}
                placeholder="Untitled"
                className="input-sm border-base-300 w-full"
              />
            </FormField>

            <DialogFooter className="flex gap-2 border-t border-base-300 pt-3 mt-2">
              <Button
                type="submit"
                className="btn-primary"
                loading={busy}
                disabled={busy || !name.trim() || !launchValue.trim()}
              >
                Create
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
