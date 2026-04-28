import type { ReactNode } from "react";
import type { ActionType } from "../../../types/workflow";
import { actionLabels } from "../../../lib/workflowUi";
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
  const titleId = `step-help-title-${actionType}`;

  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="step-help-dialog"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{language === "vi" ? "Trợ giúp step" : "Step Help"}</p>
            <h2 id={titleId}>{actionLabels[actionType]} Help</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="help-language-switch" aria-label="Help language">
          <button
            aria-pressed={language === "vi"}
            className={language === "vi" ? "help-language-active" : ""}
            type="button"
            onClick={() => onLanguageChange("vi")}
          >
            Tiếng Việt
          </button>
          <button
            aria-pressed={language === "en"}
            className={language === "en" ? "help-language-active" : ""}
            type="button"
            onClick={() => onLanguageChange("en")}
          >
            English
          </button>
        </div>

        <div className="step-help-body">
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
      </section>
    </div>
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
