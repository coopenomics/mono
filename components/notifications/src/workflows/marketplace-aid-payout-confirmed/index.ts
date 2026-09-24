import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceAidPayoutConfirmedPayloadSchema = z.object({
  memberName: z.string(),
  amount: z.string(),
  paymentDestination: z.string().optional(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceAidPayoutConfirmedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceAidPayoutConfirmed.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'materialnaya-pomosch-vyplachena';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceAidPayoutConfirmed')
  .description(nt('marketplaceAidPayoutConfirmed.description'))
  .payloadSchema(marketplaceAidPayoutConfirmedPayloadSchema)
  .tags(['marketplace', 'member'])
  .addSteps([
    createEmailStep(
      'marketplace-aid-payout-confirmed-email',
      nt('marketplaceAidPayoutConfirmed.email.subject'),
      nt('marketplaceAidPayoutConfirmed.email.body')
    ),
    createInAppStep(
      'marketplace-aid-payout-confirmed-notification',
      nt('marketplaceAidPayoutConfirmed.inApp.subject'),
      nt('marketplaceAidPayoutConfirmed.inApp.body')
    ),
    createPushStep(
      'marketplace-aid-payout-confirmed-push',
      nt('marketplaceAidPayoutConfirmed.push.subject'),
      nt('marketplaceAidPayoutConfirmed.push.body')
    ),
  ])
  .build();
