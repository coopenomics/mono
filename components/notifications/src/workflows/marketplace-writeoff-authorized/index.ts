import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceWriteoffAuthorizedPayloadSchema = z.object({
  recipientName: z.string(),
  coopname: z.string(),
  proposal_id: z.string(),
  proposal_hash: z.string(),
  itemsCount: z.number(),
  totalAmount: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceWriteoffAuthorizedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Совет авторизовал проект списания скоропорта';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление администратору и председателю: совет одобрил Протокол списания, начинается per-item исполнение.')
  .payloadSchema(marketplaceWriteoffAuthorizedPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-authorized-email',
      'Списание скоропорта авторизовано советом',
      'Здравствуйте, {{payload.recipientName}}!<br><br>Совет одобрил Протокол о списании <strong>{{payload.itemsCount}}</strong> позиций на сумму <strong>{{payload.totalAmount}}</strong>. Backend запустил per-item списания через execwroff.<br><br>Открыть проект: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-writeoff-authorized-notification',
      'Совет авторизовал списание',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
    createPushStep(
      'marketplace-writeoff-authorized-push',
      'Совет авторизовал списание',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
  ])
  .build();
