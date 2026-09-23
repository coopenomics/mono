import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceReturnClaimSubmittedPayloadSchema = z.object({
  // Имя ПОЛУЧАТЕЛЯ письма, а не председателя: заявление уходит веером всем
  // операторам пункта выдачи — председателю участка и его доверенным лицам,
  // они равны в правах по столу ПВЗ (см. matrix: ReturnClaim.decide у operator).
  recipientName: z.string(),
  ordererName: z.string(),
  brananame: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  reasonExcerpt: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnClaimSubmittedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceReturnClaimSubmitted.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'novoe-zayavlenie-na-garantiyniy-vozvrat';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceReturnClaimSubmitted')
  .description(nt('marketplaceReturnClaimSubmitted.description'))
  .payloadSchema(marketplaceReturnClaimSubmittedPayloadSchema)
  .tags(['marketplace', 'operator', 'return'])
  .addSteps([
    createEmailStep(
      'marketplace-return-claim-submitted-email',
      nt('marketplaceReturnClaimSubmitted.email.subject'),
      nt('marketplaceReturnClaimSubmitted.email.body')
    ),
    createInAppStep(
      'marketplace-return-claim-submitted-notification',
      nt('marketplaceReturnClaimSubmitted.inApp.subject'),
      nt('marketplaceReturnClaimSubmitted.inApp.body')
    ),
    createPushStep(
      'marketplace-return-claim-submitted-push',
      nt('marketplaceReturnClaimSubmitted.push.subject'),
      nt('marketplaceReturnClaimSubmitted.push.body')
    ),
  ])
  .build();
