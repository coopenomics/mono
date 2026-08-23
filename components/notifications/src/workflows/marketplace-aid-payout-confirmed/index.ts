import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceAidPayoutConfirmedPayloadSchema = z.object({
  memberName: z.string(),
  amount: z.string(),
  paymentDestination: z.string().optional(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceAidPayoutConfirmedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Материальная помощь выплачена';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику о том, что кассир подтвердил выплату материальной помощи — банковский перевод выполнен.')
  .payloadSchema(marketplaceAidPayoutConfirmedPayloadSchema)
  .tags(['marketplace', 'member'])
  .addSteps([
    createEmailStep(
      'marketplace-aid-payout-confirmed-email',
      'Материальная помощь выплачена',
      'Уважаемый {{payload.memberName}}!<br><br>Кассир подтвердил выплату материальной помощи на сумму <strong>{{payload.amount}}</strong>.<br><br>Реквизиты получения: {{payload.paymentDestination}}.<br><br>Мои средства: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-aid-payout-confirmed-notification',
      'Материальная помощь выплачена',
      'Кассир подтвердил выплату {{payload.amount}} на реквизиты {{payload.paymentDestination}}.'
    ),
    createPushStep(
      'marketplace-aid-payout-confirmed-push',
      'Материальная помощь выплачена',
      '{{payload.amount}} перечислены на ваши реквизиты.'
    ),
  ])
  .build();
