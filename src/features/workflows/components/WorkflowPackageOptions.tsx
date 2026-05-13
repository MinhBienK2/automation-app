import { Label } from "../../../components/ui/label";
import type { WorkflowSettingsSectionId } from "../../../types/workflow";

export function PackageFlowCheckbox({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Label className="package-checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </Label>
  );
}

export function PackageSectionPicker({
  availableSections,
  selectedSections,
  onSelectedSectionsChange,
}: {
  availableSections: WorkflowSettingsSectionId[];
  selectedSections: WorkflowSettingsSectionId[];
  onSelectedSectionsChange: (sections: WorkflowSettingsSectionId[]) => void;
}) {
  return (
    <fieldset className="package-section-list">
      <legend>Settings</legend>
      {availableSections.length === 0 ? (
        <p className="muted">No Settings sections in this package.</p>
      ) : (
        availableSections.map((section) => (
          <Label className="package-checkbox-field" key={section}>
            <input
              type="checkbox"
              checked={selectedSections.includes(section)}
              onChange={(event) => {
                onSelectedSectionsChange(
                  event.currentTarget.checked
                    ? [...selectedSections, section]
                    : selectedSections.filter((current) => current !== section),
                );
              }}
            />
            <span>{sectionLabel(section)}</span>
          </Label>
        ))
      )}
    </fieldset>
  );
}

export function sectionLabel(section: WorkflowSettingsSectionId) {
  switch (section) {
    case "general":
      return "General";
    case "run_policy":
      return "Run Policy";
    case "browser_launch":
      return "Browser Launch";
    case "environment":
      return "Environment";
    case "owned_test_gates":
      return "Owned Test Gates";
  }
}
