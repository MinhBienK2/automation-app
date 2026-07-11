import type {
  BrowserProfile,
  GraphValidationIssue,
  Project,
  ProjectPackage,
  ProjectPackagePreview,
  ProjectPackageWorkflow,
  SettingsValidationIssue,
  Subflow,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSummary,
} from "../../../../src/types/workflow.js";
import type { WorkflowGraphValidationOptions } from "../../graph/validateGraph.js";

type ProjectPackageServiceDependencies = {
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

export type ProjectPackageExportWorkflow = {
  workflow: WorkflowSummary;
  flow: WorkflowGraph | null;
  settings: WorkflowSettings | null;
};

export class ProjectPackageService {
  constructor(private readonly dependencies: ProjectPackageServiceDependencies) {}

  exportProjectPackage({
    project,
    browser_profiles,
    subflows,
    workflows,
  }: {
    project: Project;
    browser_profiles?: BrowserProfile[];
    subflows: Subflow[];
    workflows: ProjectPackageExportWorkflow[];
  }): ProjectPackage {
    const omittedFields: string[] = [];
    const profiles = browser_profiles ?? [];
    return {
      kind: "project_package",
      version: 1,
      project: {
        name: project.name,
        description: project.description,
      },
      included_sections: ["project", "browser_profiles", "subflows", "workflows"],
      omitted_fields: omittedFields,
      browser_profiles: profiles.map((profile) => ({
        ...structuredClone(profile),
        browser_launch: sanitizeBrowserLaunchSettings(
          profile.browser_launch,
          omittedFields,
          `browser_profiles.${profile.id}.browser_launch`,
        ),
      })),
      subflows: structuredClone(subflows),
      workflows: workflows.map(({ workflow, flow, settings }) => ({
        id: workflow.id,
        project_id: workflow.project_id ?? null,
        browser_profile_id: workflow.browser_profile_id ?? null,
        name: workflow.name,
        flow: flow ? structuredClone(flow) : null,
        settings: settings
          ? sanitizeWorkflowSettings(settings, omittedFields, `workflows.${workflow.id}.settings`)
          : null,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
      })),
    };
  }

  previewProjectPackage(packageValue: ProjectPackage): ProjectPackagePreview {
    validateProjectPackage(packageValue);
    const profiles = packageValue.browser_profiles ?? [];
    return {
      project_name: packageValue.project.name,
      workflows: packageValue.workflows.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
      })),
      subflows: packageValue.subflows.map((subflow) => ({
        id: subflow.id,
        name: subflow.name,
      })),
      browser_profiles: profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        is_default: profile.is_default,
      })),
      omitted_fields: packageValue.omitted_fields,
    };
  }

  prepareImport({
    packageValue,
    now = new Date(),
  }: {
    packageValue: ProjectPackage;
    now?: Date;
  }) {
    validateProjectPackage(packageValue);
    const timestamp = now.toISOString();
    const browser_profiles = validatePackageBrowserProfiles(
      packageValue,
      this.dependencies.defaultSettings,
      this.dependencies.validateSettings,
      timestamp,
    );
    const browserProfileById = new Map(browser_profiles.map((profile) => [profile.id, profile]));
    const subflows = validatePackageSubflows(packageValue, this.dependencies.migrateGraph);
    const subflowById = new Map(subflows.map((subflow) => [subflow.id, subflow]));

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

    const workflows = validatePackageWorkflows(
      packageValue,
      browserProfileById,
      subflowById,
      this.dependencies.migrateGraph,
      this.dependencies.validateGraph,
      this.dependencies.validateSettings,
    );

    return {
      importedName: `${packageValue.project.name} (imported)`,
      description: packageValue.project.description ?? "",
      browser_profiles,
      subflows,
      workflows,
    };
  }
}

function sanitizeWorkflowSettings(
  settings: WorkflowSettings,
  omittedFields: string[],
  fieldPrefix: string,
): WorkflowSettings {
  const sanitized = structuredClone(settings);
  sanitized.browser_launch = sanitizeBrowserLaunchSettings(
    sanitized.browser_launch,
    omittedFields,
    `${fieldPrefix}.browser_launch`,
  );
  return sanitized;
}

function sanitizeBrowserLaunchSettings(
  browser: WorkflowSettingsBrowserLaunch,
  omittedFields: string[],
  fieldPrefix: string,
): WorkflowSettingsBrowserLaunch {
  const sanitized = structuredClone(browser) as WorkflowSettingsBrowserLaunch & Record<string, unknown>;
  delete sanitized.preflight_enabled;
  delete sanitized.preflight_probe_url;
  delete sanitized.preflight_allowed_origins;
  if (sanitized.proxy_password) {
    omittedFields.push(`${fieldPrefix}.proxy_password`);
  }
  sanitized.proxy_password = null;
  if (sanitized.proxy_server) {
    const sanitizedProxyServer = sanitizeProxyServerCredentials(sanitized.proxy_server);
    if (sanitizedProxyServer !== sanitized.proxy_server) {
      omittedFields.push(`${fieldPrefix}.proxy_server.credentials`);
      sanitized.proxy_server = sanitizedProxyServer;
    }
  }
  if (sanitized.fingerprint_fonts_dir) {
    omittedFields.push(`${fieldPrefix}.fingerprint_fonts_dir`);
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

function validateProjectPackage(packageValue: ProjectPackage) {
  if (
    !packageValue ||
    typeof packageValue !== "object" ||
    packageValue.kind !== "project_package" ||
    packageValue.version !== 1
  ) {
    throw commandError("Unsupported project package", "package");
  }
  if (
    !packageValue.project ||
    typeof packageValue.project !== "object" ||
    typeof packageValue.project.name !== "string" ||
    !packageValue.project.name.trim()
  ) {
    throw commandError("Project package name is required", "package.project.name");
  }
  if (!Array.isArray(packageValue.included_sections)) {
    throw commandError("Project package sections are required", "package.included_sections");
  }
  if (!Array.isArray(packageValue.browser_profiles)) {
    throw commandError("Project package browser profiles are required", "package.browser_profiles");
  }
  if (!Array.isArray(packageValue.subflows)) {
    throw commandError("Project package subflows are required", "package.subflows");
  }
  if (!Array.isArray(packageValue.workflows)) {
    throw commandError("Project package workflows are required", "package.workflows");
  }
  if (!Array.isArray(packageValue.omitted_fields)) {
    throw commandError("Project package omitted fields are required", "package.omitted_fields");
  }
}

function validatePackageBrowserProfiles(
  packageValue: ProjectPackage,
  defaultSettings: ProjectPackageServiceDependencies["defaultSettings"],
  validateSettings: ProjectPackageServiceDependencies["validateSettings"],
  timestamp: string,
): BrowserProfile[] {
  const seenIds = new Set<string>();
  const profilesSource = packageValue.browser_profiles ?? [];
  const browser_profiles = profilesSource.map((profile, index) => {
    const record = objectRecord(profile);
    const id = stringRecordField(record, "id");
    const name = stringRecordField(record, "name");
    if (!id) {
      throw commandError("Project package profile id is required", `package.browser_profiles.${index}.id`);
    }
    if (seenIds.has(id)) {
      throw commandError("Project package profile ids must be unique", "package.browser_profiles");
    }
    seenIds.add(id);
    if (!name) {
      throw commandError("Project package profile name is required", `package.browser_profiles.${index}.name`);
    }
    if (!record.browser_launch || typeof record.browser_launch !== "object") {
      throw commandError(
        "Project package profile Browser Launch is required",
        `package.browser_profiles.${index}.browser_launch`,
      );
    }
    const browserLaunch = structuredClone(record.browser_launch) as WorkflowSettingsBrowserLaunch;
    const settings = defaultSettings({
      id: "__project_package_profile__",
      name,
      created_at: timestamp,
      updated_at: timestamp,
    });
    const settingsError = validateSettings({
      ...settings,
      browser_launch: browserLaunch,
    }).find((issue) => issue.level === "error");
    if (settingsError) {
      throw commandError(
        settingsError.message,
        settingsError.field
          ? `package.browser_profiles.${index}.browser_launch.${settingsError.field}`
          : `package.browser_profiles.${index}.browser_launch`,
      );
    }
    return {
      id,
      project_id: stringRecordField(record, "project_id"),
      name,
      description: stringRecordField(record, "description"),
      is_default: Boolean(record.is_default),
      browser_launch: browserLaunch,
      environment: record.environment && typeof record.environment === "object"
        ? (structuredClone(record.environment) as BrowserProfile["environment"])
        : undefined,
      created_at: stringRecordField(record, "created_at"),
      updated_at: stringRecordField(record, "updated_at"),
    };
  });
  if (browser_profiles.length === 0) {
    throw commandError("Project package must include at least one browser profile", "package.browser_profiles");
  }
  if (browser_profiles.filter((profile) => profile.is_default).length !== 1) {
    throw commandError("Project package must include one default browser profile", "package.browser_profiles");
  }
  return browser_profiles;
}

function validatePackageSubflows(
  packageValue: ProjectPackage,
  migrateGraph: (graph: WorkflowGraph) => WorkflowGraph,
): Subflow[] {
  const seenIds = new Set<string>();
  return packageValue.subflows.map((subflow, index) => {
    const record = objectRecord(subflow);
    const id = stringRecordField(record, "id");
    const name = stringRecordField(record, "name");
    if (!id) {
      throw commandError("Project package subflow id is required", `package.subflows.${index}.id`);
    }
    if (seenIds.has(id)) {
      throw commandError("Project package subflow ids must be unique", "package.subflows");
    }
    seenIds.add(id);
    if (!name) {
      throw commandError("Project package subflow name is required", `package.subflows.${index}.name`);
    }
    if (!record.graph || typeof record.graph !== "object") {
      throw commandError("Project package subflow graph is required", `package.subflows.${index}.graph`);
    }
    return {
      id,
      project_id: stringRecordField(record, "project_id"),
      name,
      description: stringRecordField(record, "description"),
      tags: Array.isArray(record.tags)
        ? record.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      graph: migrateGraph(record.graph as WorkflowGraph),
      created_at: stringRecordField(record, "created_at"),
      updated_at: stringRecordField(record, "updated_at"),
    };
  });
}

function validatePackageWorkflows(
  packageValue: ProjectPackage,
  browserProfileById: Map<string, BrowserProfile>,
  subflowById: Map<string, Subflow>,
  migrateGraph: (graph: WorkflowGraph) => WorkflowGraph,
  validateGraph: ProjectPackageServiceDependencies["validateGraph"],
  validateSettings: ProjectPackageServiceDependencies["validateSettings"],
): ProjectPackageWorkflow[] {
  const seenIds = new Set<string>();
  return packageValue.workflows.map((workflow, index) => {
    const record = objectRecord(workflow);
    const id = stringRecordField(record, "id");
    const name = stringRecordField(record, "name");
    if (!id) {
      throw commandError("Project package workflow id is required", `package.workflows.${index}.id`);
    }
    if (seenIds.has(id)) {
      throw commandError("Project package workflow ids must be unique", "package.workflows");
    }
    seenIds.add(id);
    if (!name) {
      throw commandError("Project package workflow name is required", `package.workflows.${index}.name`);
    }
    const profileId = stringRecordField(record, "browser_profile_id");
    if (profileId && !browserProfileById.has(profileId)) {
      throw commandError(
        "Project package is missing a referenced browser profile",
        "package.browser_profiles",
      );
    }
    if (!record.flow || typeof record.flow !== "object") {
      throw commandError("Project package workflow flow is required", `package.workflows.${index}.flow`);
    }
    const flow = migrateGraph(record.flow as WorkflowGraph);
    const missingSubflowId = callSubflowIds(flow).find((subflowId) => !subflowById.has(subflowId));
    if (missingSubflowId) {
      throw commandError(
        "Project package is missing a referenced subflow",
        "package.subflows",
      );
    }
    const flowError = validateGraph(flow, {
      projectId: "__project_package__",
      resolveSubflow(subflowId) {
        const subflow = subflowById.get(subflowId);
        return subflow
          ? {
              id: subflow.id,
              project_id: "__project_package__",
              graph: subflow.graph,
            }
          : null;
      },
    }).find((issue) =>
      issue.level === "error" && !isImportableDraftFlowIssue(issue.message)
    );
    if (flowError) {
      throw commandError(
        flowError.message,
        flowError.message === "Referenced subflow has blocking validation errors"
          ? "package.subflows"
          : "package.workflows",
      );
    }

    const settings = record.settings && typeof record.settings === "object"
      ? structuredClone(record.settings) as WorkflowSettings
      : null;
    if (settings) {
      const settingsError = validateSettings(settings).find((issue) => issue.level === "error");
      if (settingsError) {
        throw commandError(
          settingsError.message,
          settingsError.field
            ? `package.workflows.${index}.settings.${settingsError.section}.${settingsError.field}`
            : `package.workflows.${index}.settings.${settingsError.section}`,
        );
      }
    }

    return {
      id,
      project_id: stringRecordField(record, "project_id"),
      browser_profile_id: profileId || null,
      name,
      flow,
      settings,
      created_at: stringRecordField(record, "created_at"),
      updated_at: stringRecordField(record, "updated_at"),
    };
  });
}

function callSubflowIds(graph: WorkflowGraph): string[] {
  return [
    ...new Set(
      graph.nodes
        .filter((node) => node.node_type === "call_subflow")
        .map((node) => objectRecord(node.config).subflow_id)
        .filter((subflowId): subflowId is string =>
          typeof subflowId === "string" && subflowId.trim().length > 0
        ),
    ),
  ];
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringRecordField(record: Record<string, unknown>, field: string) {
  const value = record[field];
  return typeof value === "string" ? value.trim() : "";
}

function isImportableDraftFlowIssue(message: string) {
  return message === "Choose an action type before running this node";
}

function commandError(message: string, field?: string) {
  throw { message, field };
}
