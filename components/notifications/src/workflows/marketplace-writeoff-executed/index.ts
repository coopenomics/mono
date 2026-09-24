import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceWriteoffExecuted.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'spisanie-skoroporta-ispolneno';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceWriteoffExecuted')
  .description(nt('marketplaceWriteoffExecuted.description'))
  .payloadSchema(marketplaceWriteoffExecutedPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-executed-email',
      nt('marketplaceWriteoffExecuted.email.subject'),
      nt('marketplaceWriteoffExecuted.email.body')
    ),
    createInAppStep(
      'marketplace-writeoff-executed-notification',
      nt('marketplaceWriteoffExecuted.inApp.subject'),
      nt('marketplaceWriteoffExecuted.inApp.body')
    ),
    createPushStep(
      'marketplace-writeoff-executed-push',
      nt('marketplaceWriteoffExecuted.push.subject'),
      nt('marketplaceWriteoffExecuted.push.body')
    ),
  ])
  .build();
