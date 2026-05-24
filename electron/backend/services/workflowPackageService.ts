import type {
  GraphValidationIssue,
  SettingsValidationIssue,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowPackagePreview,
  WorkflowPackageSettings,
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

type WorkflowPackageServiceDependencies = {
  migrateGraph: (graph: WorkflowGraph) => WorkflowGraph;
  validateGraph: (graph: WorkflowGraph) => GraphValidationIssue[];
  validateSettings: (settings: WorkflowSettings) => SettingsValidationIssue[];
  defaultSettings: (
    workflow: Pick<WorkflowSummary, "id" | "name" | "created_at" | "updated_at"> &
      Partial<Pick<WorkflowSummary, "step_count">>,
  ) => WorkflowSettings;
};

const workflowSettingsSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "graph_defaults",
  "environment",
];

export class WorkflowPackageService {
  constructor(private readonly dependencies: WorkflowPackageServiceDependencies) {}

  exportWorkflowPackage({
    workflowName,
    flow,
    settings,
    options,
  }: {
    workflowName: string;
    flow: WorkflowGraph | null;
    settings: WorkflowSettings;
    options: WorkflowPackageExportOptions;
  }): WorkflowPackage {
    const { packageSettings, omittedFields } = buildPackageSettings(
      settings,
      options.settings_sections,
    );

    return {
      kind: "workflow_package",
      version: 2,
      workflow: { name: workflowName },
      included_sections: [
        ...(options.include_flow ? ["flow"] : []),
        ...options.settings_sections.map((section) => `settings.${section}`),
      ],
      omitted_fields: omittedFields,
      flow: options.include_flow ? flow : null,
      settings: packageSettings,
    };
  }

  previewWorkflowPackage(packageValue: WorkflowPackage): WorkflowPackagePreview {
    validateWorkflowPackage(packageValue);
    return {
      workflow_name: packageValue.workflow.name,
      includes_flow: Boolean(packageValue.flow),
      settings_sections: packageSettingsSections(packageValue),
      omitted_fields: packageValue.omitted_fields,
    };
  }

  prepareImport({
    packageValue,
    options,
    now = new Date(),
  }: {
    packageValue: WorkflowPackage;
    options: WorkflowPackageImportOptions;
    now?: Date;
  }) {
    validateWorkflowPackage(packageValue);
    const flow = packageValue.flow
      ? this.dependencies.migrateGraph(packageValue.flow)
      : null;
    if (options.include_flow && flow) {
      const flowError = this.dependencies.validateGraph(flow).find(
        (issue) => issue.level === "error" && !isImportableDraftFlowIssue(issue.message),
      );
      if (flowError) {
        throw commandError(flowError.message, "package.flow");
      }
    }

    const importedName = `${packageValue.workflow.name} (imported)`;
    const candidateSettings = packageValue.settings && options.settings_sections.length > 0
      ? this.buildImportedSettingsCandidate(
          importedName,
          now.toISOString(),
          packageValue.settings,
          options.settings_sections,
        )
      : null;
    if (candidateSettings) {
      const settingsError = this.dependencies
        .validateSettings(candidateSettings)
        .find((issue) => issue.level === "error");
      if (settingsError) {
        throw commandError(
          settingsError.message,
          settingsError.field
            ? `${settingsError.section}.${settingsError.field}`
            : settingsError.section,
        );
      }
    }

    return {
      importedName,
      flow,
      candidateSettings,
    };
  }

  private buildImportedSettingsCandidate(
    workflowName: string,
    timestamp: string,
    packageSettings: WorkflowPackageSettings,
    sections: WorkflowSettingsSectionId[],
  ): WorkflowSettings {
    let nextSettings = this.dependencies.defaultSettings({
      id: "__import_preview__",
      name: workflowName,
      step_count: 0,
      created_at: timestamp,
      updated_at: timestamp,
    });
    for (const section of sections) {
      const sectionValue = packageSettings[section];
      if (sectionValue) {
        nextSettings = {
          ...nextSettings,
          [section]: structuredClone(sectionValue),
        };
      }
    }
    return {
      ...nextSettings,
      workflow_id: "__import_preview__",
      general: {
        ...nextSettings.general,
        name: workflowName,
      },
    };
  }
}

function buildPackageSettings(
  settings: WorkflowSettings,
  sections: WorkflowSettingsSectionId[],
) {
  const packageSettings: WorkflowPackageSettings = {};
  const omittedFields: string[] = [];

  for (const section of sections) {
    if (section === "browser_launch") {
      packageSettings.browser_launch = sanitizeBrowserLaunchSettings(
        settings.browser_launch,
        omittedFields,
      );
    } else {
      packageSettings[section] = structuredClone(settings[section]) as never;
    }
  }

  return { packageSettings, omittedFields };
}

function sanitizeBrowserLaunchSettings(
  browser: WorkflowSettingsBrowserLaunch,
  omittedFields: string[],
): WorkflowSettingsBrowserLaunch {
  const sanitized = structuredClone(browser);
  if (sanitized.proxy_password) {
    omittedFields.push("settings.browser_launch.proxy_password");
  }
  sanitized.proxy_password = null;
  if (sanitized.proxy_server) {
    const sanitizedProxyServer = sanitizeProxyServerCredentials(sanitized.proxy_server);
    if (sanitizedProxyServer !== sanitized.proxy_server) {
      omittedFields.push("settings.browser_launch.proxy_server.credentials");
      sanitized.proxy_server = sanitizedProxyServer;
    }
  }
  if (sanitized.preflight_probe_url) {
    const sanitizedProbeUrl = sanitizeUrlSearch(sanitized.preflight_probe_url);
    if (sanitizedProbeUrl !== sanitized.preflight_probe_url) {
      omittedFields.push("settings.browser_launch.preflight_probe_url.search");
      sanitized.preflight_probe_url = sanitizedProbeUrl;
    }
  }
  return sanitized;
}

function sanitizeProxyServerCredentials(value: string) {
  try {
    const url = new URL(value);
    if (!url.username && !url.password) return value;
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}

function sanitizeUrlSearch(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function validateWorkflowPackage(packageValue: WorkflowPackage) {
  if (
    !packageValue ||
    typeof packageValue !== "object" ||
    packageValue.kind !== "workflow_package" ||
    packageValue.version !== 2
  ) {
    throw commandError("Unsupported workflow package", "package");
  }
  if (
    !packageValue.workflow ||
    typeof packageValue.workflow !== "object" ||
    typeof packageValue.workflow.name !== "string" ||
    !packageValue.workflow.name.trim()
  ) {
    throw commandError("Workflow package name is required", "package.workflow.name");
  }
  if (!Array.isArray(packageValue.included_sections)) {
    throw commandError("Workflow package sections are required", "package.included_sections");
  }
}

function packageSettingsSections(
  packageValue: WorkflowPackage,
): WorkflowSettingsSectionId[] {
  return packageValue.included_sections
    .filter((section) => section.startsWith("settings."))
    .map((section) => section.replace("settings.", ""))
    .filter(isWorkflowSettingsSection);
}

function isWorkflowSettingsSection(
  value: string,
): value is WorkflowSettingsSectionId {
  return workflowSettingsSections.includes(value as WorkflowSettingsSectionId);
}

function isImportableDraftFlowIssue(message: string) {
  return message === "Choose an action type before running this node";
}

function commandError(message: string, field?: string) {
  return { message, field };
}
