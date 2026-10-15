import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceWriteoffDraftBuiltPayloadSchema = z.object({
  chairmanName: z.string(),
  coopname: z.string(),
  proposal_id: z.string(),
  trigger: z.string(),
  itemsCount: z.number(),
  totalAmount: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceWriteoffDraftBuiltPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceWriteoffDraftBuilt.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sformirovan-chernovik-proekta-spisaniya-skoroporta';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceWriteoffDraftBuilt')
  .description(
    nt('marketplaceWriteoffDraftBuilt.description')
  )
  .payloadSchema(marketplaceWriteoffDraftBuiltPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-draft-built-email',
      nt('marketplaceWriteoffDraftBuilt.email.subject'),
      nt('marketplaceWriteoffDraftBuilt.email.body')
    ),
    createInAppStep(
      'marketplace-writeoff-draft-built-notification',
      nt('marketplaceWriteoffDraftBuilt.inApp.subject'),
      nt('marketplaceWriteoffDraftBuilt.inApp.body')
    ),
    createPushStep(
      'marketplace-writeoff-draft-built-push',
      nt('marketplaceWriteoffDraftBuilt.push.subject'),
      nt('marketplaceWriteoffDraftBuilt.push.body')
    ),
  ])
  .build();
