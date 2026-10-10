import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

export const accessRoleRevokedPayloadSchema = z.object({
  roleTitle: z.string(),
  roleDescription: z.string(),
  appTitle: z.string(),
});

export type IPayload = z.infer<typeof accessRoleRevokedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('accessRoleRevoked.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'rol-snyata';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('accessRoleRevoked')
  .description(nt('accessRoleRevoked.description'))
  .payloadSchema(accessRoleRevokedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep('access-role-revoked-email', nt('accessRoleRevoked.email.subject'), nt('accessRoleRevoked.email.body')),
    createInAppStep('access-role-revoked-notification', nt('accessRoleRevoked.inApp.subject'), nt('accessRoleRevoked.inApp.body')),
    createPushStep('access-role-revoked-push', nt('accessRoleRevoked.push.subject'), nt('accessRoleRevoked.push.body')),
  ])
  .build();
