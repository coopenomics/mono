import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceSupplierPaymentDeclinedPayloadSchema = z.object({
  supplierName: z.string(),
  amount: z.string(),
  reason: z.string(),
  apl_reception_id: z.string(),
  payment_request_id: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceSupplierPaymentDeclinedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Кассир отказал в выплате поставщику';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику об отказе кассира провести банковский перевод по акту приёмки — обязательство кооператива остаётся открытым, требуется уточнение реквизитов.')
  .payloadSchema(marketplaceSupplierPaymentDeclinedPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-payment-declined-email',
      'Выплата по акту приёмки {{payload.apl_reception_id}} приостановлена',
      'Уважаемый {{payload.supplierName}}!<br><br>Кассир приостановил выплату по акту приёмки <strong>{{payload.apl_reception_id}}</strong> на сумму <strong>{{payload.amount}}</strong>.<br><br>Причина: {{payload.reason}}.<br><br>Обязательство кооператива перед вами остаётся открытым; пожалуйста, свяжитесь с оператором для уточнения банковских реквизитов или сопроводительных документов.<br><br>История выплат: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-supplier-payment-declined-notification',
      'Выплата приостановлена',
      'Кассир приостановил выплату {{payload.amount}} по акту приёмки {{payload.apl_reception_id}}. Причина: {{payload.reason}}.'
    ),
    createPushStep(
      'marketplace-supplier-payment-declined-push',
      'Выплата приостановлена',
      'Кассир приостановил {{payload.amount}} по акту {{payload.apl_reception_id}}: {{payload.reason}}'
    ),
  ])
  .build();
