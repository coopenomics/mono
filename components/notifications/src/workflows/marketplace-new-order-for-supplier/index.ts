import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceNewOrderForSupplier.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'noviy-zakaz-postavschiku';

// Только in-app + push (без email): заказы поступают часто, письмо на каждый
// заказ было бы спамом. Поставщику нужен лёгкий сигнал «загляни и акцептуй».
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceNewOrderForSupplier')
  .description(nt('marketplaceNewOrderForSupplier.description'))
  .payloadSchema(marketplaceNewOrderForSupplierPayloadSchema)
  .tags(['marketplace', 'offerer'])
  .addSteps([
    createInAppStep(
      'marketplace-new-order-for-supplier-notification',
      nt('marketplaceNewOrderForSupplier.inApp.subject'),
      nt('marketplaceNewOrderForSupplier.inApp.body')
    ),
    createPushStep(
      'marketplace-new-order-for-supplier-push',
      nt('marketplaceNewOrderForSupplier.push.subject'),
      nt('marketplaceNewOrderForSupplier.push.body')
    ),
  ])
  .build();
