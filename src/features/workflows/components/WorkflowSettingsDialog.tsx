import { useState, type ReactNode } from "react";
import { HelpCircle, Save, Settings } from "lucide-react";
import type {
  BrowserProfile,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";
import type { WorkflowSettingsSaveStatus } from "../../../lib/appState";
import { Button } from "../../../components/ui/button";
import { Alert } from "../../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import {
  type WorkflowSettingsHelpLanguage,
  workflowSettingsHelp,
} from "../lib/workflowSettings";
import { HelpDisclosure } from "./HelpDisclosure";
import { GeneralSettingsSection } from "./settings/GeneralSettingsSection";
import { RunPolicySettingsSection } from "./settings/RunPolicySettingsSection";
import { BrowserLaunchSettingsSection } from "./settings/BrowserLaunchSettingsSection";
import { GraphDefaultsSettingsSection } from "./settings/GraphDefaultsSettingsSection";
import { EnvironmentSettingsSection } from "./settings/EnvironmentSettingsSection";
import { DesktopLaunchSettingsSection } from "./settings/DesktopLaunchSettingsSection";

type WorkflowSettingsDialogProps = {
  open: boolean;
  settings: WorkflowSettings | null;
  activeSection: WorkflowSettingsSectionId;
  browserProfiles?: BrowserProfile[];
  selectedBrowserProfileId?: string | null;
  error?: string;
  hasUnsavedChanges: boolean;
  onOpenChange: (open: boolean) => void;
  onActiveSectionChange: (section: WorkflowSettingsSectionId) => void;
  onBrowserProfileChange?: (profileId: string) => void;
  onSettingsChange: (settings: WorkflowSettings) => void;
  onSaveSettings: () => void | boolean | Promise<void | boolean>;
  onDiscardChanges: () => void;
  saveStatuses?: Partial<Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>>;
};

export function WorkflowSettingsDialog({
  open,
  settings,
  activeSection,
  browserProfiles = [],
  selectedBrowserProfileId = null,
  error,
  hasUnsavedChanges,
  onOpenChange,
  onActiveSectionChange,
  onBrowserProfileChange,
  onSettingsChange,
  onSaveSettings,
  onDiscardChanges,
  saveStatuses = {},
}: WorkflowSettingsDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const isDesktop = settings?.desktop_launch !== null && settings?.desktop_launch !== undefined;
  const sections = isDesktop
    ? [
        { id: "general", label: "General" },
        { id: "graph_defaults", label: "Graph" },
        { id: "run_policy", label: "Run Policy" },
        { id: "desktop_launch", label: "Desktop Launch" },
        { id: "environment", label: "Environment" },
      ]
    : [
        { id: "general", label: "General" },
        { id: "graph_defaults", label: "Graph" },
        { id: "run_policy", label: "Run Policy" },
        { id: "browser_launch", label: "Browser Launch" },
        { id: "environment", label: "Environment" },
      ];

  const currentActiveSection = isDesktop && activeSection === "browser_launch" ? "desktop_launch" : activeSection;

  const activeMeta =
    sections.find((section) => section.id === currentActiveSection) ??
    sections[0];

  const updateSection = <Section extends WorkflowSettingsSectionId>(
    section: Section,
    value: WorkflowSettings[Section],
  ) => {
    if (!settings) return;
    const nextSettings: WorkflowSettings = { ...settings, [section]: value };
    onSettingsChange(nextSettings);
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  const saveAndClose = async () => {
    const saved = await onSaveSettings();
    if (saved === false) return;
    onOpenChange(false);
    setConfirmCloseOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        {open ? (
          <DialogContent className="workflow-settings-dialog max-w-4xl max-h-[85vh] h-[650px] grid grid-rows-[auto_1fr] gap-4">
            <DialogHeader className="border-b border-base-300 pb-3 flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Settings size={20} />
                <div>
                  <p className="eyebrow">Workflow</p>
                  <DialogTitle className="font-bold text-base-content text-base">Workflow Settings</DialogTitle>
                  <DialogDescription className="sr-only">
                    Configure workflow settings before running this workflow.
                  </DialogDescription>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => {
                  if (settings) void onSaveSettings();
                }}
                disabled={!settings || Object.values(saveStatuses).some((status) => status === "saving")}
                loading={Object.values(saveStatuses).some((status) => status === "saving")}
                className="btn-primary btn-sm flex items-center gap-1.5"
              >
                <Save aria-hidden="true" size={14} />
                <span>Save Settings</span>
              </Button>
            </DialogHeader>

            <div className="flex gap-6 min-h-0 py-2">
              {/* Sidebar Navigation */}
              <ul
                aria-label="Workflow settings sections"
                className="menu bg-base-200 p-2 rounded-box w-full max-w-[220px] shrink-0 gap-1 h-fit"
                role="tablist"
              >
                {sections.map((section) => (
                  <li key={section.id}>
                    <button
                      role="tab"
                      type="button"
                      data-active={currentActiveSection === section.id ? "true" : "false"}
                      aria-selected={currentActiveSection === section.id}
                      onClick={() => onActiveSectionChange(section.id as any)}
                      disabled={!settings}
                      className={`text-xs font-semibold px-3 py-2 rounded-lg ${currentActiveSection === section.id ? "active bg-primary text-primary-content" : "text-base-content hover:bg-base-300"}`}
                    >
                      {section.label}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Content panel */}
              <section
                aria-labelledby="workflow-settings-section-title"
                className="flex-grow overflow-y-auto pr-2"
                role="tabpanel"
              >
                {settings ? (
                  <>
                    <div className="border-b border-base-300 pb-3 mb-4 flex justify-between items-start gap-4">
                      <div>
                        <h2 id="workflow-settings-section-title" className="text-base font-bold text-base-content">{activeMeta.label}</h2>
                        {currentActiveSection !== "environment" && (workflowSettingsHelp as any)[currentActiveSection] && (
                          <p className="text-secondary text-xs mt-1 leading-relaxed">{(workflowSettingsHelp as any)[currentActiveSection]?.en.summary}</p>
                        )}
                      </div>
                      <WorkflowSettingsHelpButton section={currentActiveSection as any} />
                    </div>

                    {error ? (
                      <Alert variant="error" className="text-xs p-3 mb-4">
                        {error}
                      </Alert>
                    ) : null}

                    {currentActiveSection === "general" ? (
                      <GeneralSettingsSection
                        value={settings.general}
                        onChange={(value) => updateSection("general", value)}
                      />
                    ) : null}
                    {currentActiveSection === "run_policy" ? (
                      <RunPolicySettingsSection
                        value={settings.run_policy}
                        onChange={(value) => updateSection("run_policy", value)}
                      />
                    ) : null}
                    {currentActiveSection === "browser_launch" ? (
                      <BrowserLaunchSettingsSection
                        browserProfiles={browserProfiles}
                        selectedBrowserProfileId={selectedBrowserProfileId}
                        onBrowserProfileChange={onBrowserProfileChange}
                      />
                    ) : null}
                    {currentActiveSection === "desktop_launch" ? (
                      <DesktopLaunchSettingsSection
                        value={settings.desktop_launch}
                        onChange={(value) => updateSection("desktop_launch", value)}
                      />
                    ) : null}
                    {currentActiveSection === "graph_defaults" ? (
                      <GraphDefaultsSettingsSection
                        value={settings.graph_defaults}
                        onChange={(value) => updateSection("graph_defaults", value)}
                      />
                    ) : null}
                    {currentActiveSection === "environment" ? (
                      <EnvironmentSettingsSection
                        value={settings.environment}
                        onChange={(value) => updateSection("environment", value)}
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col gap-4" aria-label="Workflow Settings Loading">
                    <div className="skeleton h-6 w-36 rounded-md" />
                    <div className="skeleton h-4 w-72 rounded-md mb-2" />
                    <div className="flex flex-col gap-3 mt-2">
                      <div className="flex flex-col gap-1">
                        <div className="skeleton h-3 w-16 rounded" />
                        <div className="skeleton h-10 w-full rounded-md" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="skeleton h-3 w-20 rounded" />
                        <div className="skeleton h-16 w-full rounded-md" />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
      <UnsavedChangesDialog
        open={confirmCloseOpen}
        onKeepEditing={() => setConfirmCloseOpen(false)}
        onDiscardChanges={() => {
          onDiscardChanges();
          setConfirmCloseOpen(false);
        }}
        onSaveAndClose={saveAndClose}
      />
    </>
  );
}

function WorkflowSettingsHelpButton({ section }: { section: WorkflowSettingsSectionId }) {
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
