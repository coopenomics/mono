import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceSupplierPaymentConfirmedPayloadSchema = z.object({
  supplierName: z.string(),
  amount: z.string(),
  paymentReference: z.string(),
  apl_reception_id: z.string(),
  payment_request_id: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceSupplierPaymentConfirmedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Выплата поставщику подтверждена кассиром';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику о подтверждённой кассиром выплате — банковский перевод выполнен, обязательство по акту приёмки закрыто.')
  .payloadSchema(marketplaceSupplierPaymentConfirmedPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-payment-confirmed-email',
      'Выплата по акту приёмки {{payload.apl_reception_id}} подтверждена',
      'Уважаемый {{payload.supplierName}}!<br><br>Кассир подтвердил выплату по акту приёмки <strong>{{payload.apl_reception_id}}</strong> на сумму <strong>{{payload.amount}}</strong>.<br><br>Номер платёжного поручения: {{payload.paymentReference}}.<br><br>История выплат: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-supplier-payment-confirmed-notification',
      'Выплата подтверждена',
      'Кассир подтвердил выплату {{payload.amount}} по акту приёмки {{payload.apl_reception_id}}. Платёжное поручение: {{payload.paymentReference}}.'
    ),
    createPushStep(
      'marketplace-supplier-payment-confirmed-push',
      'Выплата получена',
      '{{payload.amount}} по акту {{payload.apl_reception_id}}.'
    ),
  ])
  .build();
