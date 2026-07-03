import type { WorkflowSettingsEnvironment } from "../../../../types/workflow";
import { EnvironmentVariablesEditor } from "../../../projects/components/EnvironmentVariablesEditor";

type EnvironmentSettingsSectionProps = {
  value: WorkflowSettingsEnvironment;
  onChange: (value: WorkflowSettingsEnvironment) => void;
};

export function EnvironmentSettingsSection({
  value,
  onChange,
}: EnvironmentSettingsSectionProps) {
  const vars = (value.initial_variables ?? []).map((v) => ({
    name: v.name,
    value_type: v.value_type,
    value: v.value,
    persist: false,
  }));

  const handleVariablesChange = (nextVars: Array<{ name: string; value_type: any; value: string }>) => {
    onChange({
      ...value,
      initial_variables: nextVars.map((v) => ({
        name: v.name,
        value_type: v.value_type,
        value: v.value,
      })),
    });
  };

  return (
    <EnvironmentVariablesEditor
      variables={vars}
      onChange={handleVariablesChange}
      showPersistOptions={false}
    />
  );
}
