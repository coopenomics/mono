import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceWriteoffRejectedPayloadSchema = z.object({
  recipientName: z.string(),
  coopname: z.string(),
  proposal_id: z.string(),
  proposal_hash: z.string(),
  reason: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceWriteoffRejectedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Совет отклонил проект списания скоропорта';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление администратору об отказе совета в проекте списания (или истёкшем сроке повестки).')
  .payloadSchema(marketplaceWriteoffRejectedPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-rejected-email',
      'Совет отклонил проект списания',
      'Здравствуйте, {{payload.recipientName}}!<br><br>Совет отклонил проект списания скоропорта. Причина: <strong>{{payload.reason}}</strong>. Позиции остаются на складах участков.<br><br>Открыть проект: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-writeoff-rejected-notification',
      'Проект списания отклонён',
      'Причина: {{payload.reason}}'
    ),
    createPushStep(
      'marketplace-writeoff-rejected-push',
      'Проект списания отклонён',
      '{{payload.reason}}'
    ),
  ])
  .build();
