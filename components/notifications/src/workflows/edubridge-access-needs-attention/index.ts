import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const payloadSchema = z.object({
  courseTitle: z.string(),
  reason: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof payloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('edubridgeAccessNeedsAttention.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'vydacha-dostupa-trebuet-vmeshatelstva';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('edubridgeAccessNeedsAttention')
  .description(nt('edubridgeAccessNeedsAttention.description'))
  .payloadSchema(payloadSchema)
  .tags(['edubridge', 'owner'])
  .addSteps([
    createEmailStep(
      'edubridge-access-needs-attention-email',
      nt('edubridgeAccessNeedsAttention.email.subject'),
      nt('edubridgeAccessNeedsAttention.email.body')
    ),
    createInAppStep(
      'edubridge-access-needs-attention-notification',
      nt('edubridgeAccessNeedsAttention.inApp.subject'),
      nt('edubridgeAccessNeedsAttention.inApp.body')
    ),
    createPushStep(
      'edubridge-access-needs-attention-push',
      nt('edubridgeAccessNeedsAttention.push.subject'),
      nt('edubridgeAccessNeedsAttention.push.body')
    ),
  ])
  .build();
