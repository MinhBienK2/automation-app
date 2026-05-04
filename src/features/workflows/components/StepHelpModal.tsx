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
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { stepHelpContent, type StepHelpLanguage } from "../lib/stepHelpContent";

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

          <Tabs
            className="help-language-tabs-compact"
            value={language}
            onValueChange={(value) => onLanguageChange(value as StepHelpLanguage)}
          >
            <TabsList
              className="help-language-switch help-language-switch-compact"
              aria-label="Help language"
            >
              <TabsTrigger
                className={language === "vi" ? "help-language-active" : ""}
                value="vi"
              >
                VI
              </TabsTrigger>
              <TabsTrigger
                className={language === "en" ? "help-language-active" : ""}
                value="en"
              >
                EN
              </TabsTrigger>
            </TabsList>
          </Tabs>
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
                <FieldReferenceList fields={content.fieldReference} />
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

            <HelpSection title={language === "vi" ? "Lỗi hay gặp và cách sửa" : "Common mistakes and fixes"}>
              <ul>
                {content.commonMistakes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
  fields: Array<{
    name: string;
    description: string;
    requiredWhen: string;
    example?: string;
    mistakes?: string[];
    details?: string[];
    options?: Array<{
      label: string;
      value?: string;
      description: string;
      useWhen: string;
      avoidWhen?: string;
      example?: string;
    }>;
  }>;
}) {
  return (
    <div className="help-field-list">
      {fields.map((field) => (
        <div className="help-field-item help-field-reference" key={field.name}>
          <strong>{field.name}</strong>
          <p>{field.description}</p>
          <ul className="help-field-details">
            <li>{field.requiredWhen}</li>
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
                    <li>{option.useWhen}</li>
                    {option.avoidWhen ? <li>{option.avoidWhen}</li> : null}
                    {option.example ? <li>{option.example}</li> : null}
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
