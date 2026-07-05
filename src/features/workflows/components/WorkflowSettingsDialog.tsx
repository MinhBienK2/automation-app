import { useState, type ReactNode } from "react";
import { HelpCircle, Save, Settings } from "lucide-react";
import type {
  BrowserProfile,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
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
  workflowSettingsSections,
} from "../lib/workflowSettings";
import { HelpDisclosure } from "./HelpDisclosure";
import { GeneralSettingsSection } from "./settings/GeneralSettingsSection";
import { RunPolicySettingsSection } from "./settings/RunPolicySettingsSection";
import { BrowserLaunchSettingsSection } from "./settings/BrowserLaunchSettingsSection";
import { GraphDefaultsSettingsSection } from "./settings/GraphDefaultsSettingsSection";
import { EnvironmentSettingsSection } from "./settings/EnvironmentSettingsSection";

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
}: WorkflowSettingsDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const activeMeta =
    workflowSettingsSections.find((section) => section.id === activeSection) ??
    workflowSettingsSections[0];

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
          <DialogContent className="workflow-settings-dialog">
            <DialogHeader className="workflow-settings-dialog-header">
              <div className="workflow-settings-title-row">
                <div className="workflow-settings-title-copy">
                  <Settings aria-hidden="true" />
                  <div>
                    <p className="eyebrow">Workflow</p>
                    <DialogTitle>Workflow Settings</DialogTitle>
                    <DialogDescription className="sr-only">
                      Configure workflow settings before running this workflow.
                    </DialogDescription>
                  </div>
                </div>
                <Button
                  className="workflow-settings-save-button"
                  shape="pill"
                  type="button"
                  onClick={() => {
                    if (settings) void onSaveSettings();
                  }}
                  disabled={!settings}
                >
                  <Save aria-hidden="true" />
                  Save Settings
                </Button>
              </div>
            </DialogHeader>

            <div className="workflow-settings-body">
              <nav
                aria-label="Workflow settings sections"
                className="workflow-settings-sidebar"
                role="tablist"
              >
                {workflowSettingsSections.map((section) => (
                  <Button
                    key={section.id}
                    className="workflow-settings-tab"
                    data-active={activeSection === section.id ? "true" : "false"}
                    role="tab"
                    type="button"
                    variant={activeSection === section.id ? "default" : "ghost"}
                    aria-selected={activeSection === section.id}
                    onClick={() => onActiveSectionChange(section.id)}
                    disabled={!settings}
                  >
                    {section.label}
                  </Button>
                ))}
              </nav>

              <section
                aria-labelledby="workflow-settings-section-title"
                className="workflow-settings-content"
                role="tabpanel"
              >
                {settings ? (
                  <>
                    <div className="workflow-settings-section-header">
                      <div>
                        <h2 id="workflow-settings-section-title">{activeMeta.label}</h2>
                        {activeSection !== "environment" && (
                          <p>{workflowSettingsHelp[activeSection]?.en.summary}</p>
                        )}
                      </div>
                      <WorkflowSettingsHelpButton section={activeSection} />
                    </div>

                    {error ? <p className="field-error">{error}</p> : null}

                    {activeSection === "general" ? (
                      <GeneralSettingsSection
                        value={settings.general}
                        onChange={(value) => updateSection("general", value)}
                      />
                    ) : null}
                    {activeSection === "run_policy" ? (
                      <RunPolicySettingsSection
                        value={settings.run_policy}
                        onChange={(value) => updateSection("run_policy", value)}
                      />
                    ) : null}
                    {activeSection === "browser_launch" ? (
                      <BrowserLaunchSettingsSection
                        browserProfiles={browserProfiles}
                        selectedBrowserProfileId={selectedBrowserProfileId}
                        onBrowserProfileChange={onBrowserProfileChange}
                      />
                    ) : null}
                    {activeSection === "graph_defaults" ? (
                      <GraphDefaultsSettingsSection
                        value={settings.graph_defaults}
                        onChange={(value) => updateSection("graph_defaults", value)}
                      />
                    ) : null}
                    {activeSection === "environment" ? (
                      <EnvironmentSettingsSection
                        value={settings.environment}
                        onChange={(value) => updateSection("environment", value)}
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="workflow-settings-skeleton animate-pulse" aria-label="Workflow Settings Loading">
                    <div className="skeleton-title" style={{ height: "24px", width: "150px", backgroundColor: "var(--app-border)", marginBottom: "8px", borderRadius: "var(--app-radius-sm)" }} />
                    <div className="skeleton-desc" style={{ height: "16px", width: "300px", backgroundColor: "var(--app-border-light)", marginBottom: "24px", borderRadius: "var(--app-radius-sm)" }} />
                    <div className="skeleton-fields" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div className="skeleton-field">
                        <div style={{ height: "14px", width: "80px", backgroundColor: "var(--app-border-light)", marginBottom: "8px", borderRadius: "var(--app-radius-sm)" }} />
                        <div style={{ height: "36px", width: "100%", backgroundColor: "var(--app-surface-hover)", borderRadius: "var(--app-radius-md)", border: "1px solid var(--app-border)" }} />
                      </div>
                      <div className="skeleton-field">
                        <div style={{ height: "14px", width: "100px", backgroundColor: "var(--app-border-light)", marginBottom: "8px", borderRadius: "var(--app-radius-sm)" }} />
                        <div style={{ height: "80px", width: "100%", backgroundColor: "var(--app-surface-hover)", borderRadius: "var(--app-radius-md)", border: "1px solid var(--app-border)" }} />
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
          className="workflow-settings-help-button"
          type="button"
          variant="ghost"
        >
          <HelpCircle aria-hidden="true" />
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="workflow-settings-help-dialog">
        <DialogHeader
          className="workflow-settings-help-header"
          data-testid="workflow-settings-help-header"
        >
          <div>
            <DialogTitle>{help.title}</DialogTitle>
            <DialogDescription>{help.summary}</DialogDescription>
          </div>
          <SegmentedControl
            ariaLabel="Help language"
            className="workflow-settings-help-language"
            value={language}
            options={[
              { value: "en", label: "EN" },
              { value: "vi", label: "VI" },
            ]}
            onValueChange={setLanguage}
          />
        </DialogHeader>
        <div
          className="workflow-settings-help-body"
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
            className="workflow-settings-help-disclosure workflow-settings-help-list workflow-settings-help-fields"
            defaultOpen
            title={help.uiLabels.fieldGuide}
          >
            {help.fieldGuide.map((field) => (
              <WorkflowSettingsHelpItem key={field.name} title={<strong>{field.name}</strong>}>
                <p>{field.description}</p>
                {field.whenToUse ? <span>{field.whenToUse}</span> : null}
                {field.overrideBehavior ? <span>{field.overrideBehavior}</span> : null}
              </WorkflowSettingsHelpItem>
            ))}
          </HelpDisclosure>
          <HelpDisclosure
            className="workflow-settings-help-disclosure workflow-settings-help-list workflow-settings-help-examples"
            title={language === "vi" ? "Ví dụ workflow" : "Workflow examples"}
          >
            {help.workflowExamples.map((example) => (
              <WorkflowSettingsHelpItem key={example.title} title={<strong>{example.title}</strong>}>
                <ul>
                  {example.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                  {example.notes?.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </WorkflowSettingsHelpItem>
            ))}
          </HelpDisclosure>
          {help.relatedGraphActions?.length ? (
            <HelpDisclosure
              className="workflow-settings-help-disclosure workflow-settings-help-list"
              title={language === "vi" ? "Action graph liên quan" : "Related graph actions"}
            >
              {help.relatedGraphActions.map((action) => (
                <WorkflowSettingsHelpItem
                  key={`${action.action}-${action.relationship}`}
                  title={<strong>{action.action}</strong>}
                >
                  <p>{action.explanation}</p>
                </WorkflowSettingsHelpItem>
              ))}
            </HelpDisclosure>
          ) : null}
          <HelpDisclosure
            className="workflow-settings-help-disclosure workflow-settings-help-list"
            title={help.uiLabels.commonMistakes}
          >
            {help.commonMistakes.map((mistake) => (
              <WorkflowSettingsHelpItem
                key={mistake.mistake}
                title={<strong>{mistake.mistake}</strong>}
              >
                <p>{mistake.fix}</p>
              </WorkflowSettingsHelpItem>
            ))}
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
      className="workflow-settings-help-item"
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
      className="workflow-settings-help-disclosure workflow-settings-help-list"
      defaultOpen={defaultOpen}
      title={title}
    >
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </HelpDisclosure>
  );
}
