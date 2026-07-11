import type { GraphNode } from "../../../../../types/workflow";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Select } from "../../../../../components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { ActionConfigFieldGroup } from "../../ActionConfigFieldGroup";
import { TemplateTextField, type VariableOption } from "../../TemplateTextField";
import { ElementTargetSourceFields } from "../../ActionConfigElementSharedFields";
import { objectConfig, stringConfig } from "../../../lib/configUtils";

export function DataNodeFields({
  node,
  onChange,
  variableOptions,
}: {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
}) {
  const config = objectConfig(node.config);

  const updateField = (field: string, value: unknown) => {
    onChange({
      ...node,
      config: {
        ...config,
        [field]: value,
      },
    });
  };

  const handleTargetChange = (updatedDummy: any) => {
    onChange({
      ...node,
      config: {
        ...config,
        ...updatedDummy.config,
      },
    });
  };

  // Helper dummy object for ElementTargetSourceFields
  const dummyConfig = {
    type: "extract_text",
    config: config,
  } as any;

  // Group node types by configuration requirements
  const isPatternNode =
    node.node_type === "extract_numbers" ||
    node.node_type === "extract_urls" ||
    node.node_type === "extract_emails" ||
    node.node_type === "extract_regex_matches";

  const isPageLevelNode =
    node.node_type === "get_current_url" ||
    node.node_type === "get_page_title" ||
    node.node_type === "get_meta_content" ||
    node.node_type === "extract_page_links";

  if (isPatternNode) {
    return (
      <div className="graph-config-fields">
        {node.node_type === "extract_regex_matches" ? (
          <>
            <ActionConfigFieldGroup title="Regex Settings">
              <TemplateTextField
                label="Source text/variable"
                value={stringConfig(node.config, "source_name", "text")}
                onChange={(val) => updateField("source_name", val)}
                variableOptions={variableOptions}
              />
              <TemplateTextField
                label="Pattern"
                value={stringConfig(node.config, "pattern", "")}
                onChange={(val) => updateField("pattern", val)}
                variableOptions={variableOptions}
              />
              <TemplateTextField
                label="Flags"
                value={stringConfig(node.config, "flags", "g")}
                onChange={(val) => updateField("flags", val)}
                variableOptions={variableOptions}
              />
            </ActionConfigFieldGroup>
          </>
        ) : (
          <ActionConfigFieldGroup title="Source Settings">
            <TemplateTextField
              label="Source text/variable"
              value={stringConfig(node.config, "source_name", "text")}
              onChange={(val) => updateField("source_name", val)}
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        )}
        <ActionConfigFieldGroup title="Output Settings">
          <Label>
            Output Variable Name
            <Input
              value={stringConfig(node.config, "output_name", "output")}
              onChange={(e) => updateField("output_name", e.target.value)}
            />
          </Label>
        </ActionConfigFieldGroup>
      </div>
    );
  }

  if (isPageLevelNode) {
    return (
      <div className="graph-config-fields">
        {node.node_type === "get_meta_content" && (
          <ActionConfigFieldGroup title="Meta Tag Settings">
            <TemplateTextField
              label="Meta element name/property (e.g. description, og:title)"
              value={stringConfig(node.config, "meta_name", "")}
              onChange={(val) => updateField("meta_name", val)}
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        )}
        <ActionConfigFieldGroup title="Output Settings">
          <Label>
            Output Variable Name
            <Input
              value={stringConfig(node.config, "output_name", "output")}
              onChange={(e) => updateField("output_name", e.target.value)}
            />
          </Label>
        </ActionConfigFieldGroup>
      </div>
    );
  }

  // All other nodes target a DOM element
  return (
    <div className="graph-config-fields">
      <ActionConfigFieldGroup title="Target Selector">
        <ElementTargetSourceFields config={dummyConfig} onChange={handleTargetChange} />
      </ActionConfigFieldGroup>

      {/* Node-specific configuration fields */}
      {node.node_type === "extract_attribute" && (
        <ActionConfigFieldGroup title="Attribute Settings">
          <TemplateTextField
            label="Attribute Name"
            value={stringConfig(node.config, "attribute", "")}
            onChange={(val) => updateField("attribute", val)}
            variableOptions={variableOptions}
          />
        </ActionConfigFieldGroup>
      )}

      {node.node_type === "extract_computed_style" && (
        <ActionConfigFieldGroup title="Style Settings">
          <TemplateTextField
            label="CSS Property (e.g. background-color)"
            value={stringConfig(node.config, "property", "")}
            onChange={(val) => updateField("property", val)}
            variableOptions={variableOptions}
          />
        </ActionConfigFieldGroup>
      )}

      {node.node_type === "extract_table_row" && (
        <ActionConfigFieldGroup title="Row Settings">
          <Label>
            Row Index (0-based)
            <Input
              type="number"
              min="0"
              value={(config.row_index as number) ?? 0}
              onChange={(e) => updateField("row_index", parseInt(e.target.value, 10) || 0)}
            />
          </Label>
        </ActionConfigFieldGroup>
      )}

      {node.node_type === "extract_table_column" && (
        <ActionConfigFieldGroup title="Column Settings">
          <TemplateTextField
            label="Column Index or Name"
            value={stringConfig(node.config, "column", "0")}
            onChange={(val) => updateField("column", val)}
            variableOptions={variableOptions}
          />
        </ActionConfigFieldGroup>
      )}

      {node.node_type === "extract_table_cell" && (
        <ActionConfigFieldGroup title="Cell Settings">
          <Label>
            Row Index (0-based)
            <Input
              type="number"
              min="0"
              value={(config.row as number) ?? 0}
              onChange={(e) => updateField("row", parseInt(e.target.value, 10) || 0)}
            />
          </Label>
          <Label>
            Column Index (0-based)
            <Input
              type="number"
              min="0"
              value={(config.column as number) ?? 0}
              onChange={(e) => updateField("column", parseInt(e.target.value, 10) || 0)}
            />
          </Label>
        </ActionConfigFieldGroup>
      )}

      {node.node_type === "extract_list_attributes" && (
        <ActionConfigFieldGroup title="List Attributes Settings">
          <TemplateTextField
            label="Attribute Name to Extract"
            value={stringConfig(node.config, "attribute", "")}
            onChange={(val) => updateField("attribute", val)}
            variableOptions={variableOptions}
          />
        </ActionConfigFieldGroup>
      )}

      {node.node_type === "extract_structured_list" && (
        <ActionConfigFieldGroup title="Structured Mappings">
          <p className="muted mb-2">Map child selectors inside the repeating list item container.</p>
          <div className="flex flex-col gap-3">
            {(config.mappings as any[])?.map((mapping: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-2 p-2 border rounded border-border bg-muted/40 relative">
                <button
                  type="button"
                  className="absolute top-2 right-2 text-destructive hover:text-destructive/80"
                  onClick={() => {
                    const next = [...(config.mappings as any[])];
                    next.splice(idx, 1);
                    updateField("mappings", next);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Label>
                  Property Key
                  <Input
                    placeholder="e.g. title, price"
                    value={mapping.name ?? ""}
                    onChange={(e) => {
                      const next = [...(config.mappings as any[])];
                      next[idx] = { ...mapping, name: e.target.value };
                      updateField("mappings", next);
                    }}
                  />
                </Label>
                <Label>
                  Selector (relative to item)
                  <Input
                    placeholder="e.g. h3.title, span.price"
                    value={mapping.selector ?? ""}
                    onChange={(e) => {
                      const next = [...(config.mappings as any[])];
                      next[idx] = { ...mapping, selector: e.target.value };
                      updateField("mappings", next);
                    }}
                  />
                </Label>
                <Label>
                  Capture Type
                  <Select
                    value={mapping.capture_type ?? "text"}
                    onChange={(e) => {
                      const next = [...(config.mappings as any[])];
                      next[idx] = { ...mapping, capture_type: e.target.value };
                      updateField("mappings", next);
                    }}
                  >
                    <option value="text">Text Content</option>
                    <option value="attribute">Attribute</option>
                  </Select>
                </Label>
                {mapping.capture_type === "attribute" && (
                  <Label>
                    Attribute Name
                    <Input
                      placeholder="e.g. href, src"
                      value={mapping.attribute ?? ""}
                      onChange={(e) => {
                        const next = [...(config.mappings as any[])];
                        next[idx] = { ...mapping, attribute: e.target.value };
                        updateField("mappings", next);
                      }}
                    />
                  </Label>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-outline btn-xs flex items-center justify-center gap-1 self-start"
              onClick={() => {
                const next = Array.isArray(config.mappings) ? [...config.mappings] : [];
                next.push({ name: "", selector: "", capture_type: "text", attribute: "" });
                updateField("mappings", next);
              }}
            >
              <Plus className="h-3 w-3" /> Add Mapping
            </button>
          </div>
        </ActionConfigFieldGroup>
      )}

      <ActionConfigFieldGroup title="Output Settings">
        <Label>
          Output Variable Name
          <Input
            value={stringConfig(node.config, "output_name", "output")}
            onChange={(e) => updateField("output_name", e.target.value)}
          />
        </Label>
      </ActionConfigFieldGroup>
    </div>
  );
}
