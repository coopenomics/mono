import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

export const accessRoleAssignedPayloadSchema = z.object({
  roleTitle: z.string(),
  roleDescription: z.string(),
  appTitle: z.string(),
});

export type IPayload = z.infer<typeof accessRoleAssignedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('accessRoleAssigned.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'rol-naznachena';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('accessRoleAssigned')
  .description(nt('accessRoleAssigned.description'))
  .payloadSchema(accessRoleAssignedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep('access-role-assigned-email', nt('accessRoleAssigned.email.subject'), nt('accessRoleAssigned.email.body')),
    createInAppStep('access-role-assigned-notification', nt('accessRoleAssigned.inApp.subject'), nt('accessRoleAssigned.inApp.body')),
    createPushStep('access-role-assigned-push', nt('accessRoleAssigned.push.subject'), nt('accessRoleAssigned.push.body')),
  ])
  .build();
