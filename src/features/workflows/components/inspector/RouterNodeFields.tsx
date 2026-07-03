import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { ActionConfigFieldGroup } from "../ActionConfigFieldGroup";
import { ConditionFields } from "../WorkflowGraphConditionFields";
import type { GraphNode, RouterGraphConfig } from "../../../../types/workflow";
import {
  routerConfig,
  routerPortsForCases,
  nextRouterCaseId,
  defaultCondition,
} from "../../lib/graphNodeConfig";

type RouterNodeFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
};

export function RouterNodeFields({ node, onChange }: RouterNodeFieldsProps) {
  const routerConfigValue = routerConfig(node.config);
  const cases = routerConfigValue.cases;

  function updateRouterConfig(nextConfig: RouterGraphConfig) {
    onChange({
      ...node,
      config: nextConfig,
      ports: routerPortsForCases(nextConfig.cases, nextConfig.default_label ?? "Default"),
    });
  }

  return (
    <div className="graph-config-fields">
      <ActionConfigFieldGroup title="Router cases">
        <div className="router-case-table" role="group" aria-label="Router decision table">
          {cases.map((caseValue, index) => (
            <div className="router-case-row" key={caseValue.id}>
              <div className="router-case-header">
                <span className="eyebrow">Priority {index + 1}</span>
                <div className="router-case-actions">
                  <Button
                    aria-label={`Move router case ${caseValue.label || index + 1} up`}
                    disabled={index === 0}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const nextCases = [...cases];
                      [nextCases[index - 1], nextCases[index]] = [
                        nextCases[index],
                        nextCases[index - 1],
                      ];
                      updateRouterConfig({ ...routerConfigValue, cases: nextCases });
                    }}
                  >
                    Up
                  </Button>
                  <Button
                    aria-label={`Move router case ${caseValue.label || index + 1} down`}
                    disabled={index === cases.length - 1}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const nextCases = [...cases];
                      [nextCases[index], nextCases[index + 1]] = [
                        nextCases[index + 1],
                        nextCases[index],
                      ];
                      updateRouterConfig({ ...routerConfigValue, cases: nextCases });
                    }}
                  >
                    Down
                  </Button>
                  <Button
                    aria-label={`Remove router case ${caseValue.label || index + 1}`}
                    disabled={cases.length <= 1}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      updateRouterConfig({
                        ...routerConfigValue,
                        cases: cases.filter((item) => item.id !== caseValue.id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <Label>
                Router case label
                <Input
                  value={caseValue.label}
                  onChange={(event) =>
                    updateRouterConfig({
                      ...routerConfigValue,
                      cases: cases.map((item) =>
                        item.id === caseValue.id
                          ? { ...item, label: event.currentTarget.value }
                          : item,
                      ),
                    })
                  }
                />
              </Label>
              <ConditionFields
                condition={caseValue.condition}
                onChange={(condition) =>
                  updateRouterConfig({
                    ...routerConfigValue,
                    cases: cases.map((item) =>
                      item.id === caseValue.id ? { ...item, condition } : item,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
        <Button
          aria-label="Add router case"
          type="button"
          variant="secondary"
          onClick={() => {
            const nextId = nextRouterCaseId(cases);
            updateRouterConfig({
              ...routerConfigValue,
              cases: [
                ...cases,
                {
                  id: nextId,
                  label: `Case ${cases.length + 1}`,
                  condition: defaultCondition(),
                },
              ],
            });
          }}
        >
          Add case
        </Button>
      </ActionConfigFieldGroup>
      <ActionConfigFieldGroup title="Default route">
        <Label>
          Default label
          <Input
            value={routerConfigValue.default_label ?? "Default"}
            onChange={(event) =>
              updateRouterConfig({
                ...routerConfigValue,
                default_label: event.currentTarget.value,
              })
            }
          />
        </Label>
      </ActionConfigFieldGroup>
    </div>
  );
}
