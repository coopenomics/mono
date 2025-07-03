import { WorkflowDefinition } from '../types';
export * from './welcome';
export declare const allWorkflows: WorkflowDefinition[];
export declare const workflowsById: Record<string, WorkflowDefinition<import("../types").BaseWorkflowPayload>>;
