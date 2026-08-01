/**
 * Persistence DTOs for the records the renderer lists and edits.
 */

export type Project = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type WorkflowSummary = {
  id: string;
  name: string;
  step_count: number;
  project_id?: string | null;
  browser_profile_id?: string | null;
  browser_profile_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type Workflow = {
  id: string;
  name: string;
  project_id?: string | null;
  browser_profile_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowBrowserConfig = {
  workflow_id: string;
  profile_name?: string | null;
  proxy_enabled: boolean;
  proxy_server?: string | null;
  proxy_username?: string | null;
  proxy_password?: string | null;
  headless?: boolean | null;
};
