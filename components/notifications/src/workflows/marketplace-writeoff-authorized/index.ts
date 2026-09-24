import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceWriteoffAuthorized.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sovet-avtorizoval-proekt-spisaniya-skoroporta';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceWriteoffAuthorized')
  .description(nt('marketplaceWriteoffAuthorized.description'))
  .payloadSchema(marketplaceWriteoffAuthorizedPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-authorized-email',
      nt('marketplaceWriteoffAuthorized.email.subject'),
      nt('marketplaceWriteoffAuthorized.email.body')
    ),
    createInAppStep(
      'marketplace-writeoff-authorized-notification',
      nt('marketplaceWriteoffAuthorized.inApp.subject'),
      nt('marketplaceWriteoffAuthorized.inApp.body')
    ),
    createPushStep(
      'marketplace-writeoff-authorized-push',
      nt('marketplaceWriteoffAuthorized.push.subject'),
      nt('marketplaceWriteoffAuthorized.push.body')
    ),
  ])
  .build();
