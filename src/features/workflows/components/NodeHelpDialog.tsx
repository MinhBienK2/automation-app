import { useMemo, type ReactNode } from "react";
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
import type { GraphNode, ActionType } from "../../../types/workflow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { graphNodeLabel } from "../lib/workflowGraph";
import { allActionOptions } from "../../../lib/workflowUi";
import {
  graphNodeHelpContent,
  type GraphNodeFieldReference,
  type GraphNodeHelpLanguage,
} from "../lib/graphNodeHelpContent";
import type { HelpFieldCategory } from "../lib/stepHelpTypes";
import { StepHelpModal } from "./StepHelpModal";
import { HelpDisclosure } from "./HelpDisclosure";

export interface NodeHelpDialogProps {
  node: GraphNode | null;
  language: GraphNodeHelpLanguage;
  onOpenChange: (open: boolean) => void;
  onLanguageChange: (language: GraphNodeHelpLanguage) => void;
}

export function NodeHelpDialog({
  node,
  language,
  onOpenChange,
  onLanguageChange,
}: NodeHelpDialogProps) {
  const actionType = actionTypeForNodeHelp(node);
  if (actionType) {
    return (
      <StepHelpModal
        actionType={actionType}
        language={language}
        onClose={() => onOpenChange(false)}
        onLanguageChange={onLanguageChange}
      />
    );
  }

  const content = node ? (graphNodeHelpContent[node.node_type]?.[language] ?? null) : null;

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent className="step-help-dialog max-w-none">
        <DialogHeader className="modal-header">
          <div>
            <p className="eyebrow">{language === "vi" ? "Trợ giúp node" : "Node Help"}</p>
            <DialogTitle>
              {content ? content.title : `${node ? graphNodeLabel(node.node_type) : "Node"} Help`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {content?.summary ?? ""}
            </DialogDescription>
          </div>
        </DialogHeader>

        <SegmentedControl
          ariaLabel="Help language"
          className="help-language-switch"
          value={language}
          options={[
            { value: "vi", label: "Tiếng Việt" },
            { value: "en", label: "English" },
          ]}
          onValueChange={onLanguageChange}
        />

        {content ? (
          <ScrollArea className="step-help-body">
            <div
              className="step-help-body"
              style={{ overflow: "visible", paddingRight: 0 }}
            >
              <HelpSection
                defaultOpen
                title={language === "vi" ? "Node này làm gì" : "What this does"}
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

              {content.notFor?.length ? (
                <HelpSection title={language === "vi" ? "Dùng cái khác khi" : "Use something else when"}>
                  <ul>
                    {content.notFor.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
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
                <HelpFieldList fields={content.minimalConfig ?? content.fields} />
              </HelpSection>

              {content.fieldReference?.length ? (
                <HelpSection title={language === "vi" ? "Tất cả field và option" : "All fields and options"}>
                  <GraphFieldReferenceGroups fields={content.fieldReference} language={language} />
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

              {content.relatedNodes?.length ? (
                <HelpSection title={language === "vi" ? "Node liên quan" : "Related nodes"}>
                  <div className="help-field-list">
                    {content.relatedNodes.map((related) => (
                      <HelpLeafItem
                        key={`${related.node}-${related.relationship}`}
                        title={related.node}
                      >
                        <p>{related.relationship}</p>
                      </HelpLeafItem>
                    ))}
                  </div>
                </HelpSection>
              ) : null}

            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function actionTypeForNodeHelp(node: GraphNode | null) {
  if (!node) return null;
  if (node.node_type === "action") {
    const config = node.config as { type?: unknown } | null;
    const actionType = typeof config?.type === "string" ? config.type : null;
    return actionType && allActionOptions.includes(actionType as ActionType)
      ? (actionType as ActionType)
      : null;
  }
  return allActionOptions.includes(node.node_type as ActionType)
    ? (node.node_type as ActionType)
    : null;
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

function HelpFieldList({
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
      title={title}
    >
      {children}
    </HelpDisclosure>
  );
}

function GraphFieldReferenceGroups({
  fields,
  language,
}: {
  fields: GraphNodeFieldReference[];
  language: GraphNodeHelpLanguage;
}) {
  const groups = useMemo(() => {
    const map = new Map<HelpFieldCategory, GraphNodeFieldReference[]>();
    for (const f of fields) {
      const cat = f.category ?? "basic";
      let list = map.get(cat);
      if (!list) {
        list = [];
        map.set(cat, list);
      }
      list.push(f);
    }
    return map;
  }, [fields]);

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map((entry) => {
        const [cat, list] = entry;
        return (
          <HelpSection key={cat} title={categoryLabel(cat, language)}>
            <div className="help-field-list">
              {list.map((field: GraphNodeFieldReference) => (
                <HelpLeafItem className="help-field-reference" key={field.name} title={field.name}>
                  <p>{field.description}</p>
                  {field.options?.length ? (
                    <div className="help-field-options">
                      <p className="font-bold text-xs uppercase tracking-wider text-muted mt-2">
                        {language === "vi" ? "Các Lựa Chọn:" : "Available Options:"}
                      </p>
                      <ul className="list-disc pl-4 space-y-1 mt-1 text-xs">
                        {field.options.map((opt: any) => (
                          <li key={opt.value ?? ""}>
                            <span className="font-mono bg-surface-inset px-1 py-0.5 rounded text-secondary font-bold">
                              {opt.value ?? ""}
                            </span>
                            : {opt.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </HelpLeafItem>
              ))}
            </div>
          </HelpSection>
        );
      })}
    </div>
  );
}

function categoryLabel(cat: any, lang: GraphNodeHelpLanguage): string {
  const labels: Record<string, Record<GraphNodeHelpLanguage, string>> = {
    required: { vi: "Bắt buộc", en: "Required" },
    optional: { vi: "Tùy chọn", en: "Optional" },
    advanced: { vi: "Nâng cao", en: "Advanced Options" },
    basic: { vi: "Thông tin cơ bản", en: "Basic Information" },
    selector: { vi: "Định vị phần tử (Selectors)", en: "Element Selectors" },
    value: { vi: "Giá trị đầu vào (Input)", en: "Input / Value" },
    flow: { vi: "Luồng và rẽ nhánh", en: "Flow / Branching" },
    timing: { vi: "Thời gian chờ (Timing)", en: "Timing & Waits" },
    storage: { vi: "Cookie & Bộ nhớ (Storage)", en: "Storage & State" },
    behavior: { vi: "Hành vi người dùng", en: "Human Behavior emulation" },
  };
  return labels[cat]?.[lang] ?? cat;
}
