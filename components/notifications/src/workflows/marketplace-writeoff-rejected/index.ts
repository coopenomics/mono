import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceWriteoffRejected.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sovet-otklonil-proekt-spisaniya-skoroporta';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceWriteoffRejected')
  .description(nt('marketplaceWriteoffRejected.description'))
  .payloadSchema(marketplaceWriteoffRejectedPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-rejected-email',
      nt('marketplaceWriteoffRejected.email.subject'),
      nt('marketplaceWriteoffRejected.email.body')
    ),
    createInAppStep(
      'marketplace-writeoff-rejected-notification',
      nt('marketplaceWriteoffRejected.inApp.subject'),
      nt('marketplaceWriteoffRejected.inApp.body')
    ),
    createPushStep(
      'marketplace-writeoff-rejected-push',
      nt('marketplaceWriteoffRejected.push.subject'),
      nt('marketplaceWriteoffRejected.push.body')
    ),
  ])
  .build();
