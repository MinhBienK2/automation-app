import { Fragment, type ReactNode } from "react";
import type {
  ActionSchema,
  FieldDef,
  SchemaSection,
} from "../../lib/actionFields/schema";
import { numericOrTemplate } from "../../lib/actionFields/coerce";
import type { GraphNode } from "../../../../types/workflow";
import { objectConfig } from "../../lib/configUtils";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { SegmentedControl } from "../../../../components/ui/segmented-control";
import { SwitchField } from "../../../../components/ui/switch";
import { ActionConfigFieldGroup } from "../actionFields/ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "../variables/TemplateTextField";
import { VariableNumericInput } from "../variables/VariableNumericInput";

export type NodeSchemaFormProps = {
  schema: ActionSchema;
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
  /** Extra host values (e.g. subflowOptions) forwarded to custom renders. */
  extra?: Record<string, unknown>;
};

/**
 * Untyped-adapter renderer: node configs read/write a plain config object.
 * Shares widgets and coercion with the typed action-config form.
 */
export function NodeSchemaForm({
  schema,
  node,
  onChange,
  variableOptions,
  extra,
}: NodeSchemaFormProps) {
  const values = objectConfig(node.config);

  const setValue = (key: string, value: string | number | boolean | null) => {
    onChange({ ...node, config: { ...objectConfig(node.config), [key]: value } });
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
              setValue={setValue}
              variableOptions={variableOptions}
              host={{ node, onNodeChange: onChange, ...extra }}
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
  setValue,
  variableOptions,
  host,
}: {
  def: FieldDef;
  values: Record<string, unknown>;
  setValue: (key: string, value: string | number | boolean | null) => void;
  variableOptions?: VariableOption[];
  host?: Record<string, unknown>;
}) {
  if (def.widget === "custom") {
    return <>{def.render({ values, setValue, variableOptions, host })}</>;
  }
  const raw = values[def.key];
  switch (def.widget) {
    case "template":
      return (
        <TemplateTextField
          label={def.label}
          value={(raw as string) ?? (def.defaultValue as string) ?? ""}
          placeholder={def.placeholder}
          variableOptions={variableOptions}
          onChange={(val) => setValue(def.key, val)}
        />
      );
    case "textarea":
      return (
        <TemplateTextareaField
          label={def.label}
          value={(raw as string) ?? (def.defaultValue as string) ?? ""}
          placeholder={def.placeholder}
          variableOptions={variableOptions}
          onChange={(val) => setValue(def.key, val)}
        />
      );
    case "numeric":
      return (
        <VariableNumericInput
          label={def.label}
          value={
            raw !== undefined && raw !== null
              ? (raw as string | number)
              : ((def.defaultValue as string | number) ?? null)
          }
          min={def.min}
          placeholder={def.placeholder}
          onChange={(nextVal) => setValue(def.key, numericOrTemplate(nextVal))}
        />
      );
    case "text":
      return (
        <Label>
          {def.label}
          <Input
            value={(raw as string) ?? (def.defaultValue as string) ?? ""}
            placeholder={def.placeholder}
            onChange={(event) => setValue(def.key, event.currentTarget.value)}
          />
        </Label>
      );
    case "select":
      return (
        <Label>
          {def.label}
          <Select
            value={(raw as string) ?? (def.defaultValue as string) ?? ""}
            onChange={(event) => setValue(def.key, event.currentTarget.value)}
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
      const checked =
        raw === undefined || raw === null
          ? (def.defaultOn ?? (def.defaultValue as boolean) ?? false)
          : Boolean(raw);
      return (
        <SwitchField
          checked={checked}
          label={def.label}
          description={def.description}
          onCheckedChange={(next) =>
            setValue(def.key, typeof raw === "string" ? String(next) : next)
          }
        />
      );
    }
    case "segmented":
      return (
        <SegmentedControl
          ariaLabel={def.label}
          value={(raw as string) ?? (def.defaultValue as string) ?? ""}
          options={def.options}
          onValueChange={(value) => setValue(def.key, value)}
        />
      );
    default:
      return null;
  }
}
