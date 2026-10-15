import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceReturnClaimDecidedPayloadSchema = z.object({
  ordererName: z.string(),
  decisionHuman: z.string(),
  brananame: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  comment: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnClaimDecidedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceReturnClaimDecided.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'reshenie-po-zayavleniyu-na-garantiyniy-vozvrat';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceReturnClaimDecided')
  .description(nt('marketplaceReturnClaimDecided.description'))
  .payloadSchema(marketplaceReturnClaimDecidedPayloadSchema)
  .tags(['marketplace', 'orderer', 'return'])
  .addSteps([
    createEmailStep(
      'marketplace-return-claim-decided-email',
      nt('marketplaceReturnClaimDecided.email.subject'),
      nt('marketplaceReturnClaimDecided.email.body')
    ),
    createInAppStep(
      'marketplace-return-claim-decided-notification',
      nt('marketplaceReturnClaimDecided.inApp.subject'),
      nt('marketplaceReturnClaimDecided.inApp.body')
    ),
    createPushStep(
      'marketplace-return-claim-decided-push',
      nt('marketplaceReturnClaimDecided.push.subject'),
      nt('marketplaceReturnClaimDecided.push.body')
    ),
  ])
  .build();
