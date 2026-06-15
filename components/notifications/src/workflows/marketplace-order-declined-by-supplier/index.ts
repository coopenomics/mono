import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Заказ отклонён поставщиком';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику-заказчику о том, что поставщик отклонил его заказ до приёма к поставке. Указывается причина отказа — заблокированные средства возвращаются заказчику.')
  .payloadSchema(marketplaceOrderDeclinedBySupplierPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-order-declined-by-supplier-email',
      'Поставщик отклонил ваш заказ «{{payload.productName}}»',
      'Уважаемый {{payload.ordererName}}!<br><br>Поставщик отклонил ваш заказ <strong>«{{payload.productName}}»</strong> на кооперативном участке <strong>{{payload.kuName}}</strong> до приёма к поставке.<br><br>Причина отказа: <em>{{payload.reasonExcerpt}}</em><br><br>Заблокированные по заказу средства возвращены вам. Вы можете оформить заказ заново у другого поставщика.<br><br>Подробности: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-order-declined-by-supplier-notification',
      'Поставщик отклонил заказ «{{payload.productName}}»',
      'КУ {{payload.kuName}}. Причина: {{payload.reasonExcerpt}}. Средства возвращены.'
    ),
    createPushStep(
      'marketplace-order-declined-by-supplier-push',
      'Заказ «{{payload.productName}}» отклонён',
      'Поставщик отклонил заказ на КУ {{payload.kuName}}. Причина: {{payload.reasonExcerpt}}'
    ),
  ])
  .build();
