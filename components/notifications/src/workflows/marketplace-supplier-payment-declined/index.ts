import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceSupplierPaymentDeclined.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'kassir-otkazal-v-vyplate-postavschiku';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceSupplierPaymentDeclined')
  .description(nt('marketplaceSupplierPaymentDeclined.description'))
  .payloadSchema(marketplaceSupplierPaymentDeclinedPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-payment-declined-email',
      nt('marketplaceSupplierPaymentDeclined.email.subject'),
      nt('marketplaceSupplierPaymentDeclined.email.body')
    ),
    createInAppStep(
      'marketplace-supplier-payment-declined-notification',
      nt('marketplaceSupplierPaymentDeclined.inApp.subject'),
      nt('marketplaceSupplierPaymentDeclined.inApp.body')
    ),
    createPushStep(
      'marketplace-supplier-payment-declined-push',
      nt('marketplaceSupplierPaymentDeclined.push.subject'),
      nt('marketplaceSupplierPaymentDeclined.push.body')
    ),
  ])
  .build();
