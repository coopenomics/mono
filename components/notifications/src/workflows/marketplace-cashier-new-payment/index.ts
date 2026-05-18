import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Новая задача кассиру — выплата поставщику';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление кассиру о новой задаче на исходящий платёж поставщику — после закрывающей подписи председателя по акту приёмки.')
  .payloadSchema(marketplaceCashierNewPaymentPayloadSchema)
  .tags(['marketplace', 'cashier'])
  .addSteps([
    createEmailStep(
      'marketplace-cashier-new-payment-email',
      'Новая задача: выплата {{payload.amount}} поставщику {{payload.supplierName}}',
      'Уважаемый {{payload.cashierName}}!<br><br>По акту приёмки {{payload.apl_reception_id}} требуется выплата поставщику <strong>{{payload.supplierName}}</strong> на сумму <strong>{{payload.amount}}</strong>.<br><br>Откройте стол кассира, чтобы подтвердить факт банковского перевода: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-cashier-new-payment-notification',
      'Новая выплата на подтверждение',
      'Поставщик {{payload.supplierName}} ожидает выплату {{payload.amount}}.'
    ),
    createPushStep(
      'marketplace-cashier-new-payment-push',
      'Новая выплата на подтверждение',
      '{{payload.supplierName}}: {{payload.amount}}.'
    ),
  ])
  .build();
