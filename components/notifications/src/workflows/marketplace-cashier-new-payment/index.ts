import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceCashierNewPaymentPayloadSchema = z.object({
  cashierName: z.string(),
  supplierName: z.string(),
  amount: z.string(),
  apl_reception_id: z.string(),
  payment_request_id: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceCashierNewPaymentPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceCashierNewPayment.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'novaya-zadacha-kassiru-vyplata-postavschiku';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceCashierNewPayment')
  .description(nt('marketplaceCashierNewPayment.description'))
  .payloadSchema(marketplaceCashierNewPaymentPayloadSchema)
  .tags(['marketplace', 'cashier'])
  .addSteps([
    createEmailStep(
      'marketplace-cashier-new-payment-email',
      nt('marketplaceCashierNewPayment.email.subject'),
      nt('marketplaceCashierNewPayment.email.body')
    ),
    createInAppStep(
      'marketplace-cashier-new-payment-notification',
      nt('marketplaceCashierNewPayment.inApp.subject'),
      nt('marketplaceCashierNewPayment.inApp.body')
    ),
    createPushStep(
      'marketplace-cashier-new-payment-push',
      nt('marketplaceCashierNewPayment.push.subject'),
      nt('marketplaceCashierNewPayment.push.body')
    ),
  ])
  .build();
