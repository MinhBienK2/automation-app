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
  Subflow,
} from "../../../../src/types/workflow.js";
import type { WorkflowGraphValidationOptions } from "../../graph/validateGraph.js";

type WorkflowPackageServiceDependencies = {
  migrateGraph: (graph: WorkflowGraph) => WorkflowGraph;
  validateGraph: (
    graph: WorkflowGraph,
    options?: WorkflowGraphValidationOptions,
  ) => GraphValidationIssue[];
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
    subflows = [],
  }: {
    workflowName: string;
    flow: WorkflowGraph | null;
    settings: WorkflowSettings;
    options: WorkflowPackageExportOptions;
    subflows?: Subflow[];
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
        ...(subflows.length > 0 ? ["subflows"] : []),
        ...options.settings_sections.map((section: any) => `settings.${section}`),
      ],
      omitted_fields: omittedFields,
      flow: options.include_flow ? flow : null,
      subflows,
      settings: packageSettings,
    };
  }

  previewWorkflowPackage(packageValue: WorkflowPackage): WorkflowPackagePreview {
    validateWorkflowPackage(packageValue);
    return {
      workflow_name: packageValue.workflow.name,
      includes_flow: Boolean(packageValue.flow),
      subflows: packageValue.subflows?.map((subflow: any) => ({
        id: subflow.id,
        name: subflow.name,
      })) ?? [],
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
    const subflows = validatePackageSubflows(
      packageValue,
      this.dependencies.migrateGraph,
    );
    const subflowById = new Map(subflows.map((subflow) => [subflow.id, subflow]));
    const flow = packageValue.flow
      ? this.dependencies.migrateGraph(packageValue.flow)
      : null;
    for (const subflow of subflows) {
      const subflowError = this.dependencies
        .validateGraph(subflow.graph, { graphKind: "subflow" })
        .find((issue) => issue.level === "error");
      if (subflowError) {
        throw commandError(
          "Referenced subflow has blocking validation errors",
          "package.subflows",
        );
      }
    }
    if (options.include_flow && flow) {
      const missingSubflowId = callSubflowIds(flow).find(
        (subflowId) => !subflowById.has(subflowId),
      );
      if (missingSubflowId) {
        throw commandError(
          "Workflow package is missing a referenced subflow",
          "package.subflows",
        );
      }
      const flowError = this.dependencies
        .validateGraph(flow, {
          projectId: "__workflow_package__",
          resolveSubflow(subflowId) {
            const subflow = subflowById.get(subflowId);
            return subflow
              ? {
                  id: subflow.id,
                  project_id: "__workflow_package__",
                  graph: subflow.graph,
                }
              : null;
          },
        })
        .find(
          (issue) =>
            issue.level === "error" && !isImportableDraftFlowIssue(issue.message),
        );
      if (flowError) {
        throw commandError(
          flowError.message,
          flowError.message === "Referenced subflow has blocking validation errors"
            ? "package.subflows"
            : "package.flow",
        );
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
      subflows,
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
  const sanitized = structuredClone(browser) as WorkflowSettingsBrowserLaunch & Record<string, unknown>;
  delete sanitized.preflight_enabled;
  delete sanitized.preflight_probe_url;
  delete sanitized.preflight_allowed_origins;
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
  if (sanitized.fingerprint_fonts_dir) {
    omittedFields.push("settings.browser_launch.fingerprint_fonts_dir");
  }
  sanitized.fingerprint_fonts_dir = null;
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
  if (packageValue.subflows != null && !Array.isArray(packageValue.subflows)) {
    throw commandError("Workflow package subflows must be an array", "package.subflows");
  }
}

function validatePackageSubflows(
  packageValue: WorkflowPackage,
  migrateGraph: (graph: WorkflowGraph) => WorkflowGraph,
): Subflow[] {
  const packageSubflows = packageValue.subflows ?? [];
  const seenIds = new Set<string>();

  return packageSubflows.map((subflow: any, index: number) => {
    const record = objectRecord(subflow);
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!id) {
      throw commandError("Workflow package subflow id is required", `package.subflows.${index}.id`);
    }
    if (seenIds.has(id)) {
      throw commandError("Workflow package subflow ids must be unique", "package.subflows");
    }
    seenIds.add(id);
    if (!name) {
      throw commandError("Workflow package subflow name is required", `package.subflows.${index}.name`);
    }
    if (!record.graph || typeof record.graph !== "object") {
      throw commandError("Workflow package subflow graph is required", `package.subflows.${index}.graph`);
    }
    return {
      id,
      project_id: typeof record.project_id === "string" ? record.project_id : "",
      name,
      description: typeof record.description === "string" ? record.description : "",
      tags: Array.isArray(record.tags)
        ? record.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      graph: migrateGraph(record.graph as WorkflowGraph),
      created_at: typeof record.created_at === "string" ? record.created_at : "",
      updated_at: typeof record.updated_at === "string" ? record.updated_at : "",
    };
  });
}

function callSubflowIds(graph: WorkflowGraph): string[] {
  return [
    ...new Set(
      graph.nodes
        .filter((node: any) => node.node_type === "call_subflow")
        .map((node: any) => objectRecord(node.config).subflow_id)
        .filter((subflowId: unknown): subflowId is string =>
          typeof subflowId === "string" && subflowId.trim().length > 0
        ),
    ),
  ];
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function packageSettingsSections(
  packageValue: WorkflowPackage,
): WorkflowSettingsSectionId[] {
  return packageValue.included_sections
    .filter((section: string) => section.startsWith("settings."))
    .map((section: string) => section.replace("settings.", ""))
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
