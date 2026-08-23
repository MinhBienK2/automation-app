import type { ReactNode } from "react";
import type { ActionConfig } from "../../../../types/workflow";
import type { VariableOption } from "../../components/variables/TemplateTextField";

/**
 * Declarative schema for one config form. The variance axis between
 * action/node types is data (fields), not a component per type.
 */
export type FieldCondition = (values: Record<string, unknown>) => boolean;

export type FieldContext = {
  variableOptions?: VariableOption[];
  /** Host-specific extras supplied by the caller (node, subflowOptions, …). */
  host?: Record<string, unknown>;
  /** Typed action-config adapter half. */
  config?: ActionConfig;
  onChange?: (config: ActionConfig) => void;
  /** Untyped node adapter half. Use asNodeCtx to narrow. */
  values?: Record<string, unknown>;
  setValue?: (key: string, value: string | number | boolean | null) => void;
};

export type NodeFieldContext = FieldContext & {
  values: Record<string, unknown>;
  setValue: (key: string, value: string | number | boolean | null) => void;
};

export type TypedFieldContext = FieldContext & {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function asNodeCtx(ctx: FieldContext): NodeFieldContext {
  if (!ctx.values || !ctx.setValue) {
    throw new Error("Node field renderer used outside the node adapter");
  }
  return ctx as NodeFieldContext;
}

type ValueWidgetBase = {
  key: string;
  label: string;
  placeholder?: string;
  /** Shown when the config does not define the key yet. */
  defaultValue?: string | number | boolean;
  when?: FieldCondition;
};

export type FieldDef =
  | ValueWidgetBase & { widget: "template" }
  | ValueWidgetBase & { widget: "textarea" }
  | ValueWidgetBase & { widget: "numeric"; min?: number }
  | ValueWidgetBase & { widget: "text" }
  | ValueWidgetBase & {
      widget: "select";
      options: Array<{ value: string; label?: string }>;
    }
  | ValueWidgetBase & {
      widget: "switch";
      description?: string;
      /** Value when the key is absent (e.g. append defaults to on). */
      defaultOn?: boolean;
    }
  | ValueWidgetBase & {
      widget: "segmented";
      options: Array<{ value: string; label: string }>;
    }
  | {
      widget: "custom";
      when?: FieldCondition;
      /** Method syntax keeps parameter checking bivariant so each adapter
       * may narrow the context to the half it consumes. */
      render(ctx: FieldContext): ReactNode;
    };

export type SchemaSection = {
  title: string;
  when?: FieldCondition;
  /** Render fields without the surrounding field group chrome. */
  bare?: boolean;
  fields: Array<FieldDef>;
};

export type ActionSchema = {
  sections: Array<SchemaSection>;
};
