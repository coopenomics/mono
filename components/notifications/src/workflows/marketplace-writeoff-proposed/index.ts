import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceWriteoffProposed.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'proekt-spisaniya-skoroporta-na-povestke-soveta';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceWriteoffProposed')
  .description(
    nt('marketplaceWriteoffProposed.description')
  )
  .payloadSchema(marketplaceWriteoffProposedPayloadSchema)
  .tags(['marketplace', 'council', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-proposed-email',
      nt('marketplaceWriteoffProposed.email.subject'),
      nt('marketplaceWriteoffProposed.email.body')
    ),
    createInAppStep(
      'marketplace-writeoff-proposed-notification',
      nt('marketplaceWriteoffProposed.inApp.subject'),
      nt('marketplaceWriteoffProposed.inApp.body')
    ),
    createPushStep(
      'marketplace-writeoff-proposed-push',
      nt('marketplaceWriteoffProposed.push.subject'),
      nt('marketplaceWriteoffProposed.push.body')
    ),
  ])
  .build();
