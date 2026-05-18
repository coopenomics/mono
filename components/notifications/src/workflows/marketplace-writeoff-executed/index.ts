import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceWriteoffExecutedPayloadSchema = z.object({
  recipientName: z.string(),
  coopname: z.string(),
  proposal_id: z.string(),
  proposal_hash: z.string(),
  itemsCount: z.number(),
  totalAmount: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceWriteoffExecutedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Списание скоропорта исполнено';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление администратору о том, что все позиции проекта списания исполнены on-chain (executed).')
  .payloadSchema(marketplaceWriteoffExecutedPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-executed-email',
      'Списание скоропорта завершено',
      'Здравствуйте, {{payload.recipientName}}!<br><br>Backend завершил списание <strong>{{payload.itemsCount}}</strong> позиций на общую сумму <strong>{{payload.totalAmount}}</strong>. Проект переведён в финальный статус EXECUTED.<br><br>Открыть протокол: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-writeoff-executed-notification',
      'Списание завершено',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
    createPushStep(
      'marketplace-writeoff-executed-push',
      'Списание завершено',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
  ])
  .build();
