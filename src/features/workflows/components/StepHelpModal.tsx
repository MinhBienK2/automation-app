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
      <DialogContent className="step-help-dialog">
        <DialogHeader className="modal-header">
          <div>
            <p className="eyebrow">{language === "vi" ? "Trợ giúp step" : "Step Help"}</p>
            <DialogTitle>{actionLabels[actionType]} Help</DialogTitle>
            <DialogDescription className="sr-only">
              {content.summary}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs
          value={language}
          onValueChange={(value) => onLanguageChange(value as StepHelpLanguage)}
        >
          <TabsList className="help-language-switch" aria-label="Help language">
            <TabsTrigger
              className={language === "vi" ? "help-language-active" : ""}
              value="vi"
            >
              Tiếng Việt
            </TabsTrigger>
            <TabsTrigger
              className={language === "en" ? "help-language-active" : ""}
              value="en"
            >
              English
            </TabsTrigger>
          </TabsList>
        </Tabs>

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

            {content.advancedConfig?.length ? (
              <HelpSection title={language === "vi" ? "Field nâng cao" : "Advanced fields"}>
                <div className="help-field-list">
                  {content.advancedConfig.map((field) => (
                    <div className="help-field-item" key={field.name}>
                      <strong>{field.name}</strong>
                      <p>{field.description}</p>
                      {field.whenToUse ? (
                        <ul className="help-field-details">
                          <li>{field.whenToUse}</li>
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
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
