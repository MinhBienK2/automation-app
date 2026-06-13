# Architecture Quick Reference

This document maps domain concepts to the corresponding modularized state hooks and backend commands. Refer to this map to quickly locate relevant code files.

## State Hooks (Read contracts or hooks to understand API surface)

- **Workflow CRUD**: [useWorkflowWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/state/useWorkflowWorkspace.ts)
- **Graph Editing**: [useWorkflowGraphState.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/state/useWorkflowGraphState.ts)
- **Run/Execution**: [useWorkflowRunState.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/state/useWorkflowRunState.ts)
- **Settings**: [useWorkflowSettingsState.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/state/useWorkflowSettingsState.ts)
- **Recording**: [useRecordingWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/workflows/state/useRecordingWorkspace.ts)
- **Projects**: [useProjectWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/projects/state/useProjectWorkspace.ts)
- **Subflows**: [useSubflowWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/subflows/state/useSubflowWorkspace.ts)
- **Navigation**: [useAppNavigation.ts](file:///home/minhbien/Documents/automation_app/src/app/useAppNavigation.ts)
- **Evidence**: [useEvidenceWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/evidence/useEvidenceWorkspace.ts)
- **Identities**: [useIdentityLabWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/identities/useIdentityLabWorkspace.ts)
- **Schedules**: [useSchedulesWorkspace.ts](file:///home/minhbien/Documents/automation_app/src/features/schedules/useSchedulesWorkspace.ts)

## Backend Command Modules

- **Project CRUD & Env**: [projectCommands.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/projectCommands.ts)
- **Workflow CRUD**: [workflowCommands.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/workflowCommands.ts)
- **Subflows**: [subflowCommands.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/subflowCommands.ts)
- **Packages (Import/Export)**: [packageCommands.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/packageCommands.ts)
- **Recording Drafts**: [recordingCommands.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/recordingCommands.ts)
- **Settings & Diagnostics**: [settingsCommands.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/settingsCommands.ts)
- **Orchestration Entrypoint**: [index.ts](file:///home/minhbien/Documents/automation_app/electron/backend/commands/index.ts)
