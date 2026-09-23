import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceSupplierPaymentConfirmed.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'vyplata-postavschiku-podtverzhdena-kassirom';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceSupplierPaymentConfirmed')
  .description(nt('marketplaceSupplierPaymentConfirmed.description'))
  .payloadSchema(marketplaceSupplierPaymentConfirmedPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-payment-confirmed-email',
      nt('marketplaceSupplierPaymentConfirmed.email.subject'),
      nt('marketplaceSupplierPaymentConfirmed.email.body')
    ),
    createInAppStep(
      'marketplace-supplier-payment-confirmed-notification',
      nt('marketplaceSupplierPaymentConfirmed.inApp.subject'),
      nt('marketplaceSupplierPaymentConfirmed.inApp.body')
    ),
    createPushStep(
      'marketplace-supplier-payment-confirmed-push',
      nt('marketplaceSupplierPaymentConfirmed.push.subject'),
      nt('marketplaceSupplierPaymentConfirmed.push.body')
    ),
  ])
  .build();
