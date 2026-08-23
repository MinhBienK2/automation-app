import { Fragment, type ReactNode } from "react";
import type {
  ActionSchema,
  FieldDef,
  SchemaSection,
} from "../../lib/actionFields/schema";
import { numericOrTemplate } from "../../lib/actionFields/coerce";
import type { ActionConfig } from "../../../../types/workflow";
import { updateActionConfigField, type ActionConfigField } from "../../lib/workflowStepForm";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { SegmentedControl } from "../../../../components/ui/segmented-control";
import { SwitchField } from "../../../../components/ui/switch";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../variables/TemplateTextField";
import { VariableNumericInput } from "../variables/VariableNumericInput";

type SchemaFormProps = {
  schema: ActionSchema;
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  variableOptions?: VariableOption[];
};

/**
 * Renders one action config form from its declarative schema. All dispatch,
 * coercion, defaults, and visibility rules live here — schemas stay data.
 */
export function ActionConfigSchemaForm({
  schema,
  config,
  onChange,
  variableOptions,
}: SchemaFormProps) {
  const values = config.config as Record<string, unknown>;

  const setField = (key: string, value: string | number | null) => {
    onChange(updateActionConfigField(config, key as ActionConfigField, value));
  };

  return (
    <>
      {schema.sections.map((section, index) => (
        <RenderSection
          key={index}
          section={section}
          values={values}
          renderField={(def) => (
            <RenderField
              def={def}
              values={values}
              setField={setField}
              config={config}
              onChange={onChange}
              variableOptions={variableOptions}
            />
          )}
        />
      ))}
    </>
  );
}

function RenderSection({
  section,
  values,
  renderField,
}: {
  section: SchemaSection;
  values: Record<string, unknown>;
  renderField: (def: FieldDef) => ReactNode;
}) {
  if (section.when && !section.when(values)) return null;
  const visibleFields = section.fields.filter((f) => !f.when || f.when(values));
  if (visibleFields.length === 0) return null;

  if (section.bare) {
    return <>{visibleFields.map((def) => renderField(def))}</>;
  }

  return (
    <ActionConfigFieldGroup title={section.title}>
      {visibleFields.map((def, i) => (
        <Fragment key={def.widget === "custom" ? `custom-${i}` : def.key}>
          {renderField(def)}
        </Fragment>
      ))}
    </ActionConfigFieldGroup>
  );
}

function RenderField({
  def,
  values,
  setField,
  config,
  onChange,
  variableOptions,
}: {
  def: FieldDef;
  values: Record<string, unknown>;
  setField: (key: string, value: string | number | null) => void;
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  variableOptions?: VariableOption[];
}) {
  switch (def.widget) {
    case "template":
      return (
        <TemplateTextField
          label={def.label}
          value={(values[def.key] as string) ?? ""}
          placeholder={def.placeholder}
          variableOptions={variableOptions}
          onChange={(val) => setField(def.key, val)}
        />
      );
    case "textarea":
      return (
        <TemplateTextareaField
          label={def.label}
          value={(values[def.key] as string) ?? ""}
          placeholder={def.placeholder}
          variableOptions={variableOptions}
          onChange={(val) => setField(def.key, val)}
        />
      );
    case "numeric":
      return (
        <VariableNumericInput
          label={def.label}
          value={(values[def.key] as string | number | null) ?? null}
          min={def.min}
          placeholder={def.placeholder}
          onChange={(nextVal) => setField(def.key, numericOrTemplate(nextVal))}
        />
      );
    case "text":
      return (
        <Label>
          {def.label}
          <Input
            value={(values[def.key] as string) ?? ""}
            placeholder={def.placeholder}
            onChange={(event) => setField(def.key, event.currentTarget.value)}
          />
        </Label>
      );
    case "select":
      return (
        <Label>
          {def.label}
          <Select
            value={values[def.key] as string}
            onChange={(event) => setField(def.key, event.currentTarget.value)}
          >
            {def.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label ?? option.value}
              </option>
            ))}
          </Select>
        </Label>
      );
    case "switch": {
      const raw = values[def.key];
      const checked =
        raw === undefined || raw === null ? (def.defaultOn ?? false) : Boolean(raw);
      return (
        <SwitchField
          checked={checked}
          label={def.label}
          description={def.description}
          onCheckedChange={(next) => setField(def.key, String(next))}
        />
      );
    }
    case "segmented":
      return (
        <SegmentedControl
          ariaLabel={def.label}
          value={(values[def.key] as string) ?? ""}
          options={def.options}
          onValueChange={(value) => setField(def.key, value)}
        />
      );
    case "custom":
      return <>{def.render({ config, onChange, variableOptions })}</>;
    default:
      return null;
  }
}
