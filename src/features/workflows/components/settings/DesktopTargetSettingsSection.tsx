import { Alert } from "../../../../components/ui/alert";
import { FormField } from "../../../../components/ui/form-field";
import { Select } from "../../../../components/ui/select";
import type { DesktopTarget } from "../../../../types/workflow";

/**
 * The desktop counterpart of Browser Launch, in the same slot.
 *
 * Same position on purpose: a workflow has exactly one thing it runs against,
 * and where the operator looks for it should not depend on which kind it is.
 * The contents differ because the concepts do — there is no profile directory,
 * no proxy and no fingerprint here, because a Desktop Target owns none of them.
 *
 * Spec: `docs/domain/desktop/desktop-target.md`.
 */

type DesktopTargetSettingsSectionProps = {
  desktopTargets: DesktopTarget[];
  selectedDesktopTargetId: string | null;
  onDesktopTargetChange?: (targetId: string) => void;
};

export function DesktopTargetSettingsSection({
  desktopTargets,
  selectedDesktopTargetId,
  onDesktopTargetChange,
}: DesktopTargetSettingsSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-fg-primary">Desktop Target</h3>
        <p className="text-xs text-fg-muted max-w-prose">
          The application this workflow drives. Unlike a Browser Profile, a Desktop Target owns
          no storage — the application keeps its own state, shared with your own use of it, so a
          run does not start from a clean slate.
        </p>
      </div>

      {desktopTargets.length === 0 ? (
        <Alert variant="warning" className="text-xs p-2.5">
          This project has no Desktop Targets. Add one under Projects → Desktop Targets; until
          then this workflow has nothing to run against.
        </Alert>
      ) : (
        <FormField
          label="Application"
          htmlFor="workflow-settings-desktop-target"
          description="Changing this points the workflow at a different application. Steps addressing elements by name will need re-authoring."
        >
          <Select
            id="workflow-settings-desktop-target"
            value={selectedDesktopTargetId ?? ""}
            onChange={(event) => onDesktopTargetChange?.(event.currentTarget.value)}
            className="select-sm bg-base-100 border-base-300 w-full"
          >
            <option value="" disabled>
              Choose an application
            </option>
            {desktopTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}
    </div>
  );
}
