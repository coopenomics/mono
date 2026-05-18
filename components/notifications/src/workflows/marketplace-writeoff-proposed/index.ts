import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceWriteoffProposedPayloadSchema = z.object({
  recipientName: z.string(),
  coopname: z.string(),
  proposal_id: z.string(),
  proposal_hash: z.string(),
  itemsCount: z.number(),
  totalAmount: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceWriteoffProposedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Проект списания скоропорта — на повестке совета';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description(
    'Уведомление членам совета и общему администратору, что председатель подписал Заявление о списании и проект встал на повестку совета.'
  )
  .payloadSchema(marketplaceWriteoffProposedPayloadSchema)
  .tags(['marketplace', 'council', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-proposed-email',
      'На повестке: списание {{payload.itemsCount}} позиций',
      'Здравствуйте, {{payload.recipientName}}!<br><br>Председатель подписал Заявление о списании скоропорта. Проект встал на повестку совета: <strong>{{payload.itemsCount}}</strong> позиций на сумму <strong>{{payload.totalAmount}}</strong>.<br><br>Открыть проект: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-writeoff-proposed-notification',
      'Проект списания на повестке',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
    createPushStep(
      'marketplace-writeoff-proposed-push',
      'Проект списания на повестке',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
  ])
  .build();
