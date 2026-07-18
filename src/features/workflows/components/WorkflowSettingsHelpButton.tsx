import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import type { WorkflowSettingsSectionId } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import {
  type WorkflowSettingsHelpLanguage,
  workflowSettingsHelp,
} from "../lib/workflowSettings";
import { HelpDisclosure } from "./HelpDisclosure";

export function WorkflowSettingsHelpButton({ section }: { section: WorkflowSettingsSectionId }) {
  const [language, setLanguage] = useState<WorkflowSettingsHelpLanguage>("en");
  const help = workflowSettingsHelp[section]?.[language];
  if (!help) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label={`${help.title}`}
          type="button"
          variant="ghost"
          className="btn-xs text-primary hover:bg-primary/10 gap-1"
        >
          <HelpCircle aria-hidden="true" size={14} />
          <span>Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="workflow-settings-help-dialog max-w-2xl max-h-[80vh] flex flex-col gap-4">
        <DialogHeader
          className="workflow-settings-help-header border-b border-base-300 pb-3 flex flex-row items-start justify-between gap-4"
          data-testid="workflow-settings-help-header"
        >
          <div>
            <DialogTitle className="font-bold text-base-content text-base">{help.title}</DialogTitle>
            <DialogDescription className="text-secondary text-xs mt-1 leading-relaxed">{help.summary}</DialogDescription>
          </div>
          <SegmentedControl
            ariaLabel="Help language"
            value={language}
            options={[
              { value: "en", label: "EN" },
              { value: "vi", label: "VI" },
            ]}
            onValueChange={setLanguage}
          />
        </DialogHeader>
        <div
          className="workflow-settings-help-body overflow-y-auto pr-1 flex flex-col gap-4 flex-1 min-h-0"
          data-testid="workflow-settings-help-body"
        >
          <WorkflowSettingsHelpList
            defaultOpen
            items={help.bestFor}
            title={help.uiLabels.bestFor}
          />
          {help.notFor?.length ? (
            <WorkflowSettingsHelpList
              items={help.notFor}
              title={help.uiLabels.notFor}
            />
          ) : null}
          {help.precedence?.length ? (
            <WorkflowSettingsHelpList
              items={help.precedence}
              title={help.uiLabels.precedence}
            />
          ) : null}
          <HelpDisclosure
            className="border border-base-300 rounded-lg p-2 bg-base-200"
            defaultOpen
            title={help.uiLabels.fieldGuide}
          >
            <div className="flex flex-col gap-3 mt-2">
              {help.fieldGuide.map((field) => (
                <WorkflowSettingsHelpItem key={field.name} title={<strong className="text-xs text-base-content">{field.name}</strong>}>
                  <div className="text-xs text-secondary flex flex-col gap-1 mt-1 pl-1">
                    <p>{field.description}</p>
                    {field.whenToUse ? <span className="italic mt-1">{field.whenToUse}</span> : null}
                    {field.overrideBehavior ? <span className="font-semibold">{field.overrideBehavior}</span> : null}
                  </div>
                </WorkflowSettingsHelpItem>
              ))}
            </div>
          </HelpDisclosure>
          <HelpDisclosure
            className="border border-base-300 rounded-lg p-2 bg-base-200"
            title={language === "vi" ? "Ví dụ workflow" : "Workflow examples"}
          >
            <div className="flex flex-col gap-3 mt-2">
              {help.workflowExamples.map((example) => (
                <WorkflowSettingsHelpItem key={example.title} title={<strong className="text-xs text-base-content">{example.title}</strong>}>
                  <ul className="list-disc list-inside text-xs text-secondary pl-1 mt-1 flex flex-col gap-1">
                    {example.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                    {example.notes?.map((note) => (
                      <li key={note} className="italic text-secondary/85">{note}</li>
                    ))}
                  </ul>
                </WorkflowSettingsHelpItem>
              ))}
            </div>
          </HelpDisclosure>
          {help.relatedGraphActions?.length ? (
            <HelpDisclosure
              className="border border-base-300 rounded-lg p-2 bg-base-200"
              title={language === "vi" ? "Action graph liên quan" : "Related graph actions"}
            >
              <div className="flex flex-col gap-3 mt-2">
                {help.relatedGraphActions.map((action) => (
                  <WorkflowSettingsHelpItem
                    key={`${action.action}-${action.relationship}`}
                    title={<strong className="text-xs text-base-content">{action.action}</strong>}
                  >
                    <p className="text-xs text-secondary mt-1 pl-1">{action.explanation}</p>
                  </WorkflowSettingsHelpItem>
                ))}
              </div>
            </HelpDisclosure>
          ) : null}
          <HelpDisclosure
            className="border border-base-300 rounded-lg p-2 bg-base-200"
            title={help.uiLabels.commonMistakes}
          >
            <div className="flex flex-col gap-3 mt-2">
              {help.commonMistakes.map((mistake) => (
                <WorkflowSettingsHelpItem
                  key={mistake.mistake}
                  title={<strong className="text-xs text-base-content">{mistake.mistake}</strong>}
                >
                  <p className="text-xs text-secondary mt-1 pl-1">{mistake.fix}</p>
                </WorkflowSettingsHelpItem>
              ))}
            </div>
          </HelpDisclosure>
          {help.safetyNotes?.length ? (
            <WorkflowSettingsHelpList
              items={help.safetyNotes}
              title={help.uiLabels.safetyNotes}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowSettingsHelpItem({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <HelpDisclosure
      className="workflow-settings-help-item p-1"
      summaryClassName="workflow-settings-help-item-summary"
      title={title}
    >
      {children}
    </HelpDisclosure>
  );
}

function WorkflowSettingsHelpList({
  defaultOpen = false,
  items,
  title,
}: {
  defaultOpen?: boolean;
  items: string[];
  title: string;
}) {
  return (
    <HelpDisclosure
      className="border border-base-300 rounded-lg p-2 bg-base-200"
      defaultOpen={defaultOpen}
      title={title}
    >
      <ul className="list-disc list-inside text-xs text-secondary mt-2 pl-1 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </HelpDisclosure>
  );
}
