import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceOrderDeclinedBySupplierPayloadSchema = z.object({
  ordererName: z.string(),
  productName: z.string(),
  kuName: z.string(),
  reasonExcerpt: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceOrderDeclinedBySupplierPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceOrderDeclinedBySupplier.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'zakaz-otklonyon-postavschikom';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceOrderDeclinedBySupplier')
  .description(nt('marketplaceOrderDeclinedBySupplier.description'))
  .payloadSchema(marketplaceOrderDeclinedBySupplierPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-order-declined-by-supplier-email',
      nt('marketplaceOrderDeclinedBySupplier.email.subject'),
      nt('marketplaceOrderDeclinedBySupplier.email.body')
    ),
    createInAppStep(
      'marketplace-order-declined-by-supplier-notification',
      nt('marketplaceOrderDeclinedBySupplier.inApp.subject'),
      nt('marketplaceOrderDeclinedBySupplier.inApp.body')
    ),
    createPushStep(
      'marketplace-order-declined-by-supplier-push',
      nt('marketplaceOrderDeclinedBySupplier.push.subject'),
      nt('marketplaceOrderDeclinedBySupplier.push.body')
    ),
  ])
  .build();
