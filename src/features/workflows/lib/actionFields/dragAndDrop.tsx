import type { ActionConfig } from "../../../../types/workflow";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { SegmentedControl } from "../../../../components/ui/segmented-control";
import { TemplateTextField } from "../../components/variables/TemplateTextField";
import { VariableNumericInput } from "../../components/variables/VariableNumericInput";
import { ActionConfigFieldGroup } from "../../components/actionFields/ActionConfigFieldGroup";
import { StructuredTargetFields } from "../../components/actionFields/ActionConfigElementSharedFields";
import { numericOrTemplate } from "./coerce";
import type { TypedFieldContext } from "./schema";
import type { ActionSchema } from "./schema";

function DragTargetPositionFields({
  config,
  onChange,
}: {
  config: Extract<ActionConfig, { type: "drag_and_drop" }>;
  onChange: (config: ActionConfig) => void;
}) {
  const position = config.config.target_position ?? { mode: "center" as const };

  const updatePosition = (
    targetPosition: NonNullable<typeof config.config.target_position>,
  ) => {
    onChange({
      type: "drag_and_drop",
      config: {
        ...config.config,
        target_position: targetPosition,
      },
    });
  };

  const numericOrNull = (nextVal: string | number | null | undefined): number | null => {
    const val = numericOrTemplate(nextVal);
    return typeof val === "number" ? val : null;
  };

  return (
    <>
      <Label>
        Destination position
        <Select
          value={position.mode}
          onChange={(event) => {
            const mode = event.currentTarget.value;
            if (mode === "percent") {
              updatePosition({ mode: "percent", x_percent: 50, y_percent: 50 });
              return;
            }
            if (mode === "offset") {
              updatePosition({ mode: "offset", x_px: 0, y_px: 0 });
              return;
            }
            updatePosition({ mode: "center" });
          }}
        >
          <option value="center">Center of target</option>
          <option value="percent">Percent inside target</option>
          <option value="offset">Pixel offset inside target</option>
        </Select>
      </Label>

      {position.mode === "percent" ? (
        <>
          <VariableNumericInput
            label="X percent"
            min={0}
            max={100}
            value={position.x_percent}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                x_percent: numericOrNull(nextVal) ?? position.x_percent,
              });
            }}
          />
          <VariableNumericInput
            label="Y percent"
            min={0}
            max={100}
            value={position.y_percent}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                y_percent: numericOrNull(nextVal) ?? position.y_percent,
              });
            }}
          />
        </>
      ) : null}

      {position.mode === "offset" ? (
        <>
          <VariableNumericInput
            label="X offset px"
            value={position.x_px}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                x_px: numericOrNull(nextVal) ?? position.x_px,
              });
            }}
          />
          <VariableNumericInput
            label="Y offset px"
            value={position.y_px}
            onChange={(nextVal) => {
              updatePosition({
                ...position,
                y_px: numericOrNull(nextVal) ?? position.y_px,
              });
            }}
          />
        </>
      ) : null}
    </>
  );
}

function DragEndpointSourceFields({
  config,
  onChange,
  refField,
  targetField,
  labelPrefix,
  selectionLabel,
  refLabel,
}: {
  config: Extract<ActionConfig, { type: "drag_and_drop" }>;
  onChange: (config: ActionConfig) => void;
  refField: "source_ref" | "target_ref";
  targetField: "source_target" | "target_target";
  labelPrefix: string;
  selectionLabel: string;
  refLabel: string;
}) {
  const rawConfig = config.config as Record<string, unknown>;
  const refValue = rawConfig[refField] as string | null | undefined;
  const targetSource = refValue != null ? "ref" : "locator";

  const updateRef = (nextValue: string | null) => {
    onChange({
      ...config,
      config: {
        ...config.config,
        [refField]: nextValue,
      },
    } as ActionConfig);
  };

  return (
    <>
      <div className="grid gap-1.5">
        <Label>{selectionLabel}</Label>
        <SegmentedControl
          ariaLabel={selectionLabel}
          value={targetSource}
          options={[
            { label: "Use locator", value: "locator" },
            { label: "Use Find Element ref", value: "ref" },
          ]}
          onValueChange={(value) => updateRef(value === "ref" ? (refValue ?? "") : null)}
        />
      </div>
      {targetSource === "ref" ? (
        <>
          <TemplateTextField
            label={refLabel}
            value={refValue ?? ""}
            onChange={(val) => updateRef(val)}
            placeholder="Output name from Find Element"
          />
          <p className="text-xs leading-5 text-[var(--app-text-muted)]">
            This endpoint uses the element resolved by a previous Find Element node in this run.
          </p>
        </>
      ) : (
        <StructuredTargetFields
          config={config}
          onChange={onChange}
          targetField={targetField}
          labelPrefix={labelPrefix}
          showConstraints={false}
        />
      )}
    </>
  );
}

export const dragAndDropSchemas: Partial<Record<string, ActionSchema>> = {
  drag_and_drop: {
    sections: [
      {
        title: "Drag source",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) =>
              config.type === "drag_and_drop" ? (
                <DragEndpointSourceFields
                  config={config}
                  onChange={onChange}
                  refField="source_ref"
                  targetField="source_target"
                  labelPrefix="Source"
                  selectionLabel="Source selection"
                  refLabel="Source ref"
                />
              ) : null,
          },
        ],
      },
      {
        title: "Drop setup",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) =>
              config.type === "drag_and_drop" ? (
                <>
                  <ActionConfigFieldGroup title="Drop target" nested>
                    <DragEndpointSourceFields
                      config={config}
                      onChange={onChange}
                      refField="target_ref"
                      targetField="target_target"
                      labelPrefix="Target"
                      selectionLabel="Drop target source"
                      refLabel="Drop target ref"
                    />
                  </ActionConfigFieldGroup>
                  <ActionConfigFieldGroup title="Drop point" nested>
                    <DragTargetPositionFields config={config} onChange={onChange} />
                  </ActionConfigFieldGroup>
                </>
              ) : null,
          },
        ],
      },
    ],
  },
};
