import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceNewOrderForSupplierPayloadSchema = z.object({
  supplierName: z.string(),
  ordererName: z.string(),
  quantity: z.number(),
  totalCost: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceNewOrderForSupplierPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Новый заказ поставщику';
export const id = slugify(name);

// Только in-app + push (без email): заказы поступают часто, письмо на каждый
// заказ было бы спамом. Поставщику нужен лёгкий сигнал «загляни и акцептуй».
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику о том, что по его предложению поступил новый заказ — повод зайти на стол и принять его.')
  .payloadSchema(marketplaceNewOrderForSupplierPayloadSchema)
  .tags(['marketplace', 'offerer'])
  .addSteps([
    createInAppStep(
      'marketplace-new-order-for-supplier-notification',
      'Новый заказ',
      'Поступил новый заказ на {{payload.quantity}} ед. на сумму {{payload.totalCost}} — зайдите на стол поставщика, чтобы принять его.'
    ),
    createPushStep(
      'marketplace-new-order-for-supplier-push',
      'Новый заказ',
      'Поступил новый заказ на {{payload.quantity}} ед. — примите его на столе поставщика.'
    ),
  ])
  .build();
