import { type ReactNode } from "react";
import {
  BookOpen,
  Target,
  AlertTriangle,
  GitBranch,
  Settings,
  FileCode,
  Network,
  ArrowUpRight,
  ShieldAlert,
  Info
} from "lucide-react";
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
import { HelpDisclosure } from "./HelpDisclosure";

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
      <DialogContent className="step-help-dialog action-help-dialog max-w-none">
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
            <HelpSection
              defaultOpen
              title={language === "vi" ? "Action này làm gì" : "What this does"}
            >
              <p>{content.summary}</p>
            </HelpSection>

            <HelpSection
              defaultOpen
              title={language === "vi" ? "Dùng khi" : "Use it when"}
            >
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
                      <HelpLeafItem
                        key={`${item.action}-${item.when}`}
                        title={item.action}
                      >
                        <p>{item.when}</p>
                      </HelpLeafItem>
                    ))}
                  </div>
                ) : null}
              </HelpSection>
            ) : null}

            {content.portSemantics?.length ? (
              <HelpSection
                defaultOpen
                title={language === "vi" ? "Port và luồng chạy" : "Ports and flow"}
              >
                <div className="help-field-list">
                  {content.portSemantics.map((port) => (
                    <HelpLeafItem key={port.port} title={port.port}>
                      <p>{port.description}</p>
                      <ul className="help-field-details">
                        <li>{port.kind}</li>
                        <li>{port.required ? "required" : "optional"}</li>
                      </ul>
                    </HelpLeafItem>
                  ))}
                </div>
              </HelpSection>
            ) : null}

            <HelpSection
              defaultOpen
              title={language === "vi" ? "Cấu hình tối thiểu" : "Minimum setup"}
            >
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
                    <HelpLeafItem key={output.name} title={output.name}>
                      <p>{output.description}</p>
                      <ul className="help-field-details">
                        {output.usedBy.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </HelpLeafItem>
                  ))}
                </div>
              </HelpSection>
            ) : null}

            <HelpSection title={language === "vi" ? "Ví dụ workflow" : "Workflow examples"}>
              <div className="help-field-list">
                {(content.workflowExamples ?? [
                  { title: language === "vi" ? "Ví dụ" : "Example", steps: content.examples },
                ]).map((example) => (
                  <HelpLeafItem key={example.title} title={example.title}>
                    <ul className="help-field-details">
                      {example.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </HelpLeafItem>
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

function getSectionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("làm gì") || t.includes("does")) {
    return <BookOpen size={16} className="text-accent" />;
  }
  if (t.includes("dùng khi") || t.includes("use it when")) {
    return <Target size={16} className="text-success" />;
  }
  if (t.includes("dùng cái khác") || t.includes("use something else")) {
    return <AlertTriangle size={16} className="text-warning" />;
  }
  if (t.includes("port") || t.includes("luồng")) {
    return <GitBranch size={16} className="text-accent" />;
  }
  if (t.includes("tối thiểu") || t.includes("setup") || t.includes("cấu hình")) {
    return <Settings size={16} className="text-accent" />;
  }
  if (t.includes("tất cả field") || t.includes("options") || t.includes("lựa chọn")) {
    return <Settings size={16} className="text-accent" />;
  }
  if (t.includes("ví dụ") || t.includes("examples")) {
    return <FileCode size={16} className="text-purple-400" />;
  }
  if (t.includes("liên quan") || t.includes("related")) {
    return <Network size={16} className="text-accent" />;
  }
  if (t.includes("output") || t.includes("được tạo")) {
    return <ArrowUpRight size={16} className="text-success" />;
  }
  if (t.includes("an toàn") || t.includes("safety")) {
    return <ShieldAlert size={16} className="text-error" />;
  }
  return <Info size={16} className="text-accent" />;
}

function HelpSection({
  children,
  defaultOpen = false,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  const icon = getSectionIcon(title);
  return (
    <HelpDisclosure
      className="help-section"
      defaultOpen={defaultOpen}
      title={
        <span className="flex items-center gap-2 font-semibold">
          {icon}
          <span>{title}</span>
        </span>
      }
    >
      {children}
    </HelpDisclosure>
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
        <HelpLeafItem key={field.name} title={field.name}>
          <p>{field.description}</p>
          {field.details?.length ? (
            <ul className="help-field-details">
              {field.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </HelpLeafItem>
      ))}
    </div>
  );
}

function HelpLeafItem({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title: ReactNode;
}) {
  return (
    <HelpDisclosure
      className={["help-field-item", "help-field-leaf", className]
        .filter(Boolean)
        .join(" ")}
      summaryClassName="help-field-leaf-summary"
      title={title}
    >
      {children}
    </HelpDisclosure>
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
        <HelpLeafItem
          className="help-field-reference"
          key={field.name}
          title={(
            <span className="help-field-title-row">
            <strong>{field.name}</strong>
            <span className={`help-field-badge help-field-badge-${field.category}`}>
              {field.category}
            </span>
            </span>
          )}
        >
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
                <HelpDisclosure
                  className="help-option-item help-option-disclosure"
                  key={`${field.name}-${option.label}`}
                  summaryClassName="help-option-summary"
                  title={(
                    <strong>
                    {option.label}
                    {option.value ? <span>{option.value}</span> : null}
                    </strong>
                  )}
                >
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
                </HelpDisclosure>
              ))}
            </div>
          ) : null}
        </HelpLeafItem>
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
          <HelpDisclosure
            className="help-field-group"
            key={category}
            defaultOpen={category === "required"}
            summaryClassName="help-field-group-summary"
            title={<h4>{labels[category]}</h4>}
          >
            <FieldReferenceList fields={groupFields} />
          </HelpDisclosure>
        );
      })}
    </div>
  );
}
