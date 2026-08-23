import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { NumberInput } from "../../../../components/ui/number-input";
import { Label } from "../../../../components/ui/label";
import { ActionConfigFieldGroup } from "../actionFields/ActionConfigFieldGroup";
import type { GraphNode } from "../../../../types/workflow";
import {
  randomChoiceConfig,
  randomChoicePortsForChoices,
  nextRandomChoiceId,
  type RandomChoiceGraphConfig,
} from "../../lib/graphNodeConfig";

type RandomChoiceNodeFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
};

export function RandomChoiceNodeFields({ node, onChange }: RandomChoiceNodeFieldsProps) {
  const randomChoiceConfigValue = randomChoiceConfig(node.config);
  const choices = randomChoiceConfigValue.choices;

  function updateRandomChoiceConfig(nextConfig: RandomChoiceGraphConfig) {
    onChange({
      ...node,
      config: nextConfig,
      ports: randomChoicePortsForChoices(nextConfig.choices),
    });
  }

  return (
    <div className="graph-config-fields">
      <ActionConfigFieldGroup title="Choice output">
        <Label>
          Output name
          <Input
            value={randomChoiceConfigValue.output_name ?? ""}
            onChange={(event) =>
              updateRandomChoiceConfig({
                ...randomChoiceConfigValue,
                output_name: event.currentTarget.value,
              })
            }
          />
        </Label>
      </ActionConfigFieldGroup>
      <ActionConfigFieldGroup title="Weighted choices">
        <div className="router-case-table" role="group" aria-label="Random choice table">
          {choices.map((choice, index) => (
            <div className="router-case-row" key={choice.id}>
              <div className="router-case-header">
                <span className="eyebrow">Choice {index + 1}</span>
                <div className="router-case-actions">
                  <Button
                    aria-label={`Remove random choice ${choice.label || index + 1}`}
                    disabled={choices.length <= 1}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      updateRandomChoiceConfig({
                        ...randomChoiceConfigValue,
                        choices: choices.filter((item) => item.id !== choice.id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <Label>
                Choice label
                <Input
                  value={choice.label}
                  onChange={(event) =>
                    updateRandomChoiceConfig({
                      ...randomChoiceConfigValue,
                      choices: choices.map((item) =>
                        item.id === choice.id
                          ? { ...item, label: event.currentTarget.value }
                          : item,
                      ),
                    })
                  }
                />
              </Label>
              <Label>
                Choice weight
                <NumberInput
                  min={1}
                  value={choice.weight}
                  fallback={1}
                  onChange={(val) =>
                    updateRandomChoiceConfig({
                      ...randomChoiceConfigValue,
                      choices: choices.map((item) =>
                        item.id === choice.id
                          ? { ...item, weight: val ?? 1 }
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
          aria-label="Add random choice"
          type="button"
          variant="secondary"
          onClick={() => {
            const nextId = nextRandomChoiceId(choices);
            updateRandomChoiceConfig({
              ...randomChoiceConfigValue,
              choices: [
                ...choices,
                { id: nextId, label: `Choice ${choices.length + 1}`, weight: 1 },
              ],
            });
          }}
        >
          Add choice
        </Button>
      </ActionConfigFieldGroup>
    </div>
  );
}


