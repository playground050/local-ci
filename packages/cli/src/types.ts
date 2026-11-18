import type { WorkflowService, WorkflowContainer } from "./workflow/workflow-parser.ts";

export interface Job {
  deliveryId: string;
  eventType: string;
  repository?: {
    owner?: {
      login: string;
    };
    name: string;
    full_name?: string;
    default_branch?: string;
  };
  env?: Record<string, string>;
  githubJobId?: string | number;
  githubRepo?: string;
  githubToken?: string;
  localSync?: boolean;
  localPath?: string;
  headSha?: string;
  runnerName?: string;
  steps?: any[];
  services?: WorkflowService[];
  container?: WorkflowContainer;
  taskId?: string;
  workflowPath?: string;
  /** Top-level workflow path for display grouping (when workflowPath is a reusable callee) */
  parentWorkflowPath?: string;
  /** `github.workflow`: the top-level workflow's `name:` (or its repo-relative path when unnamed) */
  workflowName?: string;
  /** Repo-relative path of the top-level workflow file, for `github.workflow_ref` */
  workflowFile?: string;
  [key: string]: any;
}
