import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { ActionConfigFieldGroup } from "../ActionConfigFieldGroup";
import type { GraphNode, SwitchGraphConfig } from "../../../../types/workflow";
import {
  switchConfig,
  switchPortsForCases,
  nextSwitchCaseId,
} from "../../lib/graphNodeConfig";

type SwitchNodeFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
};

export function SwitchNodeFields({ node, onChange }: SwitchNodeFieldsProps) {
  const switchConfigValue = switchConfig(node.config);
  const cases = switchConfigValue.cases;

  function updateSwitchConfig(nextConfig: SwitchGraphConfig) {
    onChange({
      ...node,
      config: nextConfig,
      ports: switchPortsForCases(nextConfig.cases),
    });
  }

  return (
    <div className="graph-config-fields">
      <ActionConfigFieldGroup title="Switch config">
        <Label>
          Switch expression
          <Input
            placeholder="e.g. {{status}}"
            value={switchConfigValue.expression}
            onChange={(event) =>
              updateSwitchConfig({
                ...switchConfigValue,
                expression: event.currentTarget.value,
              })
            }
          />
        </Label>
      </ActionConfigFieldGroup>

      <ActionConfigFieldGroup title="Switch cases">
        <div className="router-case-table" role="group" aria-label="Switch decision table">
          {cases.map((caseValue, index) => (
            <div className="router-case-row" key={caseValue.id}>
              <div className="router-case-header">
                <span className="eyebrow">Case {index + 1}</span>
                <div className="router-case-actions">
                  <Button
                    aria-label={`Move case ${caseValue.value || index + 1} up`}
                    disabled={index === 0}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const nextCases = [...cases];
                      [nextCases[index - 1], nextCases[index]] = [
                        nextCases[index],
                        nextCases[index - 1],
                      ];
                      updateSwitchConfig({ ...switchConfigValue, cases: nextCases });
                    }}
                  >
                    Up
                  </Button>
                  <Button
                    aria-label={`Move case ${caseValue.value || index + 1} down`}
                    disabled={index === cases.length - 1}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const nextCases = [...cases];
                      [nextCases[index], nextCases[index + 1]] = [
                        nextCases[index + 1],
                        nextCases[index],
                      ];
                      updateSwitchConfig({ ...switchConfigValue, cases: nextCases });
                    }}
                  >
                    Down
                  </Button>
                  <Button
                    aria-label={`Remove case ${caseValue.value || index + 1}`}
                    disabled={cases.length <= 1}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      updateSwitchConfig({
                        ...switchConfigValue,
                        cases: cases.filter((item) => item.id !== caseValue.id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <Label>
                Case value
                <Input
                  value={caseValue.value}
                  onChange={(event) =>
                    updateSwitchConfig({
                      ...switchConfigValue,
                      cases: cases.map((item) =>
                        item.id === caseValue.id
                          ? { ...item, value: event.currentTarget.value }
                          : item,
                      ),
                    })
                  }
                />
              </Label>
            </div>
          ))}
        </div>
        <Button
          aria-label="Add switch case"
          className="mt-2"
          type="button"
          variant="secondary"
          onClick={() => {
            const nextId = nextSwitchCaseId(cases);
            updateSwitchConfig({
              ...switchConfigValue,
              cases: [
                ...cases,
                {
                  id: nextId,
                  value: "",
                },
              ],
            });
          }}
        >
          Add case
        </Button>
      </ActionConfigFieldGroup>
    </div>
  );
}
