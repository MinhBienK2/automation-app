import type { ReactNode } from "react";
import type { ActionType } from "../../../types/workflow";
import { actionLabels } from "../../../lib/workflowUi";
import { Button } from "../../../components/ui/button";
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
          <Button variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
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
            <HelpSection title={language === "vi" ? "Step này làm gì?" : "What this step does"}>
              <p>{content.summary}</p>
            </HelpSection>

            <HelpSection title={language === "vi" ? "Khi nào dùng?" : "When to use it"}>
              <ul>
                {content.useWhen.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </HelpSection>

            <HelpSection title={language === "vi" ? "Giải thích field" : "Field guide"}>
              <div className="help-field-list">
                {content.fields.map((field) => (
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
            </HelpSection>

            <HelpSection title={language === "vi" ? "Ví dụ" : "Examples"}>
              <ul>
                {content.examples.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </HelpSection>

            <HelpSection title={language === "vi" ? "Dễ nhầm" : "Common mistakes"}>
              <ul>
                {content.commonMistakes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </HelpSection>
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
