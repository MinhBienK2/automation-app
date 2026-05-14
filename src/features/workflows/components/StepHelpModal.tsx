import type { ReactNode } from "react";
import type { ActionType } from "../../../types/workflow";
import { actionLabels } from "../../../lib/workflowUi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { stepHelpContent } from "../lib/stepHelpContent";
import type {
  ActionFieldReference,
  HelpFieldCategory,
  StepHelpLanguage,
} from "../lib/stepHelpTypes";

type StepHelpModalProps = {
  actionType: ActionType;
  language: StepHelpLanguage;
  onClose: () => void;
  onLanguageChange: (language: StepHelpLanguage) => void;
};

export function StepHelpModal({
  actionType,
  language,
  onClose,
  onLanguageChange,
}: StepHelpModalProps) {
  const content = stepHelpContent[actionType][language];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="step-help-dialog action-help-dialog">
        <DialogHeader className="modal-header action-help-header" data-testid="action-help-header">
          <div>
            <p className="eyebrow">{language === "vi" ? "Hướng dẫn action" : "Action guide"}</p>
            <DialogTitle>{actionLabels[actionType]} Help</DialogTitle>
            <DialogDescription className="sr-only">
              {content.summary}
            </DialogDescription>
          </div>

          <SegmentedControl
            ariaLabel="Help language"
            className="help-language-switch help-language-switch-compact help-language-tabs-compact"
            value={language}
            options={[
              { value: "vi", label: "VI" },
              { value: "en", label: "EN" },
            ]}
            onValueChange={onLanguageChange}
          />
        </DialogHeader>

        <ScrollArea className="step-help-body">
          <div
            className="step-help-body"
            style={{ overflow: "visible", paddingRight: 0 }}
          >
            <HelpSection title={language === "vi" ? "Action này làm gì" : "What this does"}>
              <p>{content.summary}</p>
            </HelpSection>

            <HelpSection title={language === "vi" ? "Dùng khi" : "Use it when"}>
              <ul>
                {content.useWhen.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </HelpSection>

            {content.notFor?.length || content.chooseInstead?.length ? (
              <HelpSection title={language === "vi" ? "Dùng cái khác khi" : "Use something else when"}>
                {content.notFor?.length ? (
                  <ul>
                    {content.notFor.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {content.chooseInstead?.length ? (
                  <div className="help-field-list">
                    {content.chooseInstead.map((item) => (
                      <div className="help-field-item" key={`${item.action}-${item.when}`}>
                        <strong>{item.action}</strong>
                        <p>{item.when}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </HelpSection>
            ) : null}

            <HelpSection title={language === "vi" ? "Cấu hình tối thiểu" : "Minimum setup"}>
              <FieldList fields={content.minimalConfig ?? content.fields} />
            </HelpSection>

            {content.fieldReference?.length ? (
              <HelpSection title={language === "vi" ? "Tất cả field và option" : "All fields and options"}>
                <FieldReferenceGroups fields={content.fieldReference} language={language} />
              </HelpSection>
            ) : null}

            {content.outputs?.length ? (
              <HelpSection title={language === "vi" ? "Output được tạo" : "Outputs created"}>
                <div className="help-field-list">
                  {content.outputs.map((output) => (
                    <div className="help-field-item" key={output.name}>
                      <strong>{output.name}</strong>
                      <p>{output.description}</p>
                      <ul className="help-field-details">
                        {output.usedBy.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </HelpSection>
            ) : null}

            <HelpSection title={language === "vi" ? "Ví dụ workflow" : "Workflow examples"}>
              <div className="help-field-list">
                {(content.workflowExamples ?? [
                  { title: language === "vi" ? "Ví dụ" : "Example", steps: content.examples },
                ]).map((example) => (
                  <div className="help-field-item" key={example.title}>
                    <strong>{example.title}</strong>
                    <ul className="help-field-details">
                      {example.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </HelpSection>

            {content.safetyNotes?.length ? (
              <HelpSection title={language === "vi" ? "Lưu ý an toàn" : "Safety notes"}>
                <ul>
                  {content.safetyNotes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </HelpSection>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function HelpSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="help-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function FieldList({
  fields,
}: {
  fields: Array<{
    name: string;
    description: string;
    details?: string[];
  }>;
}) {
  return (
    <div className="help-field-list">
      {fields.map((field) => (
        <div className="help-field-item" key={field.name}>
          <strong>{field.name}</strong>
          <p>{field.description}</p>
          {field.details?.length ? (
            <ul className="help-field-details">
              {field.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FieldReferenceList({
  fields,
}: {
  fields: ActionFieldReference[];
}) {
  return (
    <div className="help-field-list">
      {fields.map((field) => (
        <div className="help-field-item help-field-reference" key={field.name}>
          <div className="help-field-title-row">
            <strong>{field.name}</strong>
            <span className={`help-field-badge help-field-badge-${field.category}`}>
              {field.category}
            </span>
          </div>
          <p>{field.description}</p>
          <ul className="help-field-details">
            <li>{field.requiredWhen}</li>
            {field.valueGuidance ? <li>{field.valueGuidance}</li> : null}
            {field.example ? <li>{field.example}</li> : null}
            {field.details?.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
            {field.mistakes?.map((mistake) => (
              <li key={mistake}>{mistake}</li>
            ))}
          </ul>
          {field.options?.length ? (
            <div className="help-option-list">
              {field.options.map((option) => (
                <div className="help-option-item" key={`${field.name}-${option.label}`}>
                  <strong>
                    {option.label}
                    {option.value ? <span>{option.value}</span> : null}
                  </strong>
                  <p>{option.description}</p>
                  <ul className="help-field-details">
                    <li>
                      <span className="help-option-label">Use when</span>
                      {option.useWhen}
                    </li>
                    {option.avoidWhen ? (
                      <li>
                        <span className="help-option-label">Avoid when</span>
                        {option.avoidWhen}
                      </li>
                    ) : null}
                    {option.example ? (
                      <li>
                        <span className="help-option-label">Example</span>
                        {option.example}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FieldReferenceGroups({
  fields,
  language,
}: {
  fields: ActionFieldReference[];
  language: StepHelpLanguage;
}) {
  const groupOrder: HelpFieldCategory[] = ["required", "optional", "advanced"];
  const labels: Record<HelpFieldCategory, string> = {
    required: language === "vi" ? "Bắt buộc" : "Required",
    optional: language === "vi" ? "Tùy chọn" : "Optional",
    advanced: language === "vi" ? "Nâng cao" : "Advanced",
  };

  return (
    <div className="help-field-groups">
      {groupOrder.map((category) => {
        const groupFields = fields.filter((field) => field.category === category);
        if (!groupFields.length) return null;
        return (
          <section className="help-field-group" key={category}>
            <h4>{labels[category]}</h4>
            <FieldReferenceList fields={groupFields} />
          </section>
        );
      })}
    </div>
  );
}
