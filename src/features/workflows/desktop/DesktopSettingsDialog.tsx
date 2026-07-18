import { useState } from "react";
import { Save, Settings } from "lucide-react";
import type {
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
} from "../../../components/ui/dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { WorkflowSettingsHelpButton } from "../components/WorkflowSettingsHelpButton";
import { GeneralSettingsSection } from "../components/settings/GeneralSettingsSection";
import { RunPolicySettingsSection } from "../components/settings/RunPolicySettingsSection";
import { DesktopLaunchSettingsSection } from "./DesktopLaunchSettingsSection";
import { GraphDefaultsSettingsSection } from "../components/settings/GraphDefaultsSettingsSection";
import { EnvironmentSettingsSection } from "../components/settings/EnvironmentSettingsSection";
import { workflowSettingsHelp } from "../lib/workflowSettings";

type DesktopSettingsDialogProps = {
  open: boolean;
  settings: WorkflowSettings | null;
  activeSection: WorkflowSettingsSectionId;
  error?: string;
  hasUnsavedChanges: boolean;
  onOpenChange: (open: boolean) => void;
  onActiveSectionChange: (section: WorkflowSettingsSectionId) => void;
  onSettingsChange: (settings: WorkflowSettings) => void;
  onSaveSettings: () => void | boolean | Promise<void | boolean>;
  onDiscardChanges: () => void;
  saveStatuses?: Partial<Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>>;
};

const DESKTOP_SECTIONS = [
  { id: "general", label: "General" },
  { id: "graph_defaults", label: "Graph" },
  { id: "run_policy", label: "Run Policy" },
  { id: "desktop_launch", label: "Desktop Launch" },
  { id: "environment", label: "Environment" },
];

export function DesktopSettingsDialog({
  open,
  settings,
  activeSection,
  error,
  hasUnsavedChanges,
  onOpenChange,
  onActiveSectionChange,
  onSettingsChange,
  onSaveSettings,
  onDiscardChanges,
  saveStatuses = {},
}: DesktopSettingsDialogProps) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const currentActiveSection = activeSection === "browser_launch" ? "desktop_launch" : activeSection;
  const activeMeta = DESKTOP_SECTIONS.find((s) => s.id === currentActiveSection) ?? DESKTOP_SECTIONS[0];

  const updateSection = <S extends WorkflowSettingsSectionId>(sec: S, val: WorkflowSettings[S]) => settings && onSettingsChange({ ...settings, [sec]: val });
  const requestOpenChange = (nextOpen: boolean) => (!nextOpen && hasUnsavedChanges) ? setConfirmCloseOpen(true) : onOpenChange(nextOpen);

  return (
    <>
      <Dialog open={open} onOpenChange={requestOpenChange}>
        {open ? (
          settings ? (
            <DesktopSettingsDialogBody
              isSaving={Object.values(saveStatuses).some((s) => s === "saving")}
              onSave={() => settings && onSaveSettings()}
              sections={DESKTOP_SECTIONS}
              currentActiveSection={currentActiveSection}
              onSelectSection={(sec) => settings && onActiveSectionChange(sec)}
              activeMeta={activeMeta}
              settings={settings}
              error={error}
              onUpdateSection={updateSection}
            />
          ) : (
            <DialogContent className="workflow-settings-dialog max-w-4xl max-h-[85vh] h-[650px] grid grid-rows-[auto_1fr] gap-4">
              <DesktopSettingsHeader isSaving={false} onSave={() => {}} />
              <div className="flex gap-6 min-h-0 py-2">
                <div className="w-[220px] shrink-0" />
                <section className="flex-grow overflow-y-auto pr-2">
                  <DesktopSettingsLoadingSkeleton />
                </section>
              </div>
            </DialogContent>
          )
        ) : null}
      </Dialog>
      <UnsavedChangesDialog
        open={confirmCloseOpen}
        onKeepEditing={() => setConfirmCloseOpen(false)}
        onDiscardChanges={() => {
          onDiscardChanges();
          setConfirmCloseOpen(false);
        }}
        onSaveAndClose={async () => {
          const saved = await onSaveSettings();
          if (saved !== false) {
            onOpenChange(false);
            setConfirmCloseOpen(false);
          }
        }}
      />
    </>
  );
}

type DesktopSettingsDialogBodyProps = {
  isSaving: boolean;
  onSave: () => void;
  sections: Array<{ id: string; label: string }>;
  currentActiveSection: string;
  onSelectSection: (section: WorkflowSettingsSectionId) => void;
  activeMeta: { id: string; label: string };
  settings: WorkflowSettings;
  error?: string;
  onUpdateSection: (section: any, value: any) => void;
};

function DesktopSettingsDialogBody({
  isSaving,
  onSave,
  sections,
  currentActiveSection,
  onSelectSection,
  activeMeta,
  settings,
  error,
  onUpdateSection,
}: DesktopSettingsDialogBodyProps) {
  return (
    <DialogContent className="workflow-settings-dialog max-w-4xl max-h-[85vh] h-[650px] grid grid-rows-[auto_1fr] gap-4">
      <DesktopSettingsHeader isSaving={isSaving} onSave={onSave} />
      <div className="flex gap-6 min-h-0 py-2">
        <DesktopSettingsSidebar
          sections={sections}
          currentActiveSection={currentActiveSection}
          onSelect={onSelectSection}
        />
        <section aria-labelledby="workflow-settings-section-title" className="flex-grow overflow-y-auto pr-2" role="tabpanel">
          <div className="border-b border-base-300 pb-3 mb-4 flex justify-between items-start gap-4">
            <div>
              <h2 id="workflow-settings-section-title" className="text-base font-bold text-base-content">{activeMeta.label}</h2>
              {currentActiveSection !== "environment" && (workflowSettingsHelp as any)[currentActiveSection] && (
                <p className="text-secondary text-xs mt-1 leading-relaxed">{(workflowSettingsHelp as any)[currentActiveSection]?.en.summary}</p>
              )}
            </div>
            <WorkflowSettingsHelpButton section={currentActiveSection as any} />
          </div>
          {error && <Alert variant="error" className="text-xs p-3 mb-4">{error}</Alert>}
          <DesktopSettingsSectionRenderer
            section={currentActiveSection}
            settings={settings}
            onUpdateSection={onUpdateSection}
          />
        </section>
      </div>
    </DialogContent>
  );
}

function DesktopSettingsHeader({ isSaving, onSave }: { isSaving: boolean; onSave: () => void }) {
  return (
    <DialogHeader className="border-b border-base-300 pb-3 flex flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-primary font-bold">
        <Settings size={20} />
        <div>
          <p className="eyebrow">Workflow</p>
          <DialogTitle className="font-bold text-base-content text-base">Workflow Settings</DialogTitle>
          <DialogDescription className="sr-only">Configure workflow settings before running this workflow.</DialogDescription>
        </div>
      </div>
      <Button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        loading={isSaving}
        className="btn-primary btn-sm flex items-center gap-1.5"
      >
        <Save aria-hidden="true" size={14} />
        <span>Save Settings</span>
      </Button>
    </DialogHeader>
  );
}

function DesktopSettingsSidebar({
  sections,
  currentActiveSection,
  onSelect,
}: {
  sections: Array<{ id: string; label: string }>;
  currentActiveSection: string;
  onSelect: (section: WorkflowSettingsSectionId) => void;
}) {
  return (
    <ul aria-label="Workflow settings sections" className="menu bg-base-200 p-2 rounded-box w-full max-w-[220px] shrink-0 gap-1 h-fit" role="tablist">
      {sections.map((section) => (
        <li key={section.id}>
          <button
            role="tab"
            type="button"
            data-active={currentActiveSection === section.id ? "true" : "false"}
            aria-selected={currentActiveSection === section.id}
            onClick={() => onSelect(section.id as any)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg ${currentActiveSection === section.id ? "active bg-primary text-primary-content" : "text-base-content hover:bg-base-300"}`}
          >
            {section.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function DesktopSettingsSectionRenderer({
  section,
  settings,
  onUpdateSection,
}: {
  section: WorkflowSettingsSectionId;
  settings: WorkflowSettings;
  onUpdateSection: (section: any, value: any) => void;
}) {
  switch (section) {
    case "general":
      return <GeneralSettingsSection value={settings.general} onChange={(val) => onUpdateSection("general", val)} />;
    case "run_policy":
      return <RunPolicySettingsSection value={settings.run_policy} onChange={(val) => onUpdateSection("run_policy", val)} />;
    case "desktop_launch":
      return (
        <DesktopLaunchSettingsSection
          value={settings.desktop_launch}
          onChange={(val) => onUpdateSection("desktop_launch", val)}
        />
      );
    case "graph_defaults":
      return <GraphDefaultsSettingsSection value={settings.graph_defaults} onChange={(val) => onUpdateSection("graph_defaults", val)} />;
    case "environment":
      return <EnvironmentSettingsSection value={settings.environment} onChange={(val) => onUpdateSection("environment", val)} />;
    default:
      return null;
  }
}

function DesktopSettingsLoadingSkeleton() {
  return (
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
  );
}
