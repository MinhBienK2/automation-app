import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { SettingsFieldGroup } from "../../../../components/ui/settings-field-group";
import type { WorkflowSettingsGeneral } from "../../../../types/workflow";
import { tagsFromInput, tagsToInput } from "../../lib/workflowSettings";

type GeneralSettingsSectionProps = {
  value: WorkflowSettingsGeneral;
  onChange: (value: WorkflowSettingsGeneral) => void;
};

export function GeneralSettingsSection({
  value,
  onChange,
}: GeneralSettingsSectionProps) {
  return (
    <SettingsFieldGroup
      title="Workflow details"
      description="Name and describe the workflow so it is easy to find, export, and audit."
    >
      <label className="field">
        <span>Workflow name</span>
        <Input
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.currentTarget.value })}
        />
      </label>
      <label className="field settings-field-group-wide">
        <span>Description</span>
        <Textarea
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.currentTarget.value })}
        />
      </label>
      <label className="field">
        <span>Tags</span>
        <Input
          value={tagsToInput(value.tags)}
          onChange={(event) => onChange({ ...value, tags: tagsFromInput(event.currentTarget.value) })}
        />
      </label>
      <label className="field settings-field-group-wide">
        <span>Notes</span>
        <Textarea
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.currentTarget.value })}
        />
      </label>
    </SettingsFieldGroup>
  );
}
