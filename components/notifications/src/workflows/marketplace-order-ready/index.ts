import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceOrderReadyPayloadSchema = z.object({
  ordererName: z.string(),
  kuName: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  deepLinkUrl: z.string().optional(),
  /** Напоминание о паспорте для неверифицированного получателя; пусто, если верифицирован. */
  passportReminder: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceOrderReadyPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceOrderReady.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'zakaz-gotov-k-polucheniyu';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceOrderReady')
  .description(nt('marketplaceOrderReady.description'))
  .payloadSchema(marketplaceOrderReadyPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-order-ready-email',
      nt('marketplaceOrderReady.email.subject'),
      nt('marketplaceOrderReady.email.body')
    ),
    createInAppStep(
      'marketplace-order-ready-notification',
      nt('marketplaceOrderReady.inApp.subject'),
      nt('marketplaceOrderReady.inApp.body')
    ),
    createPushStep(
      'marketplace-order-ready-push',
      nt('marketplaceOrderReady.push.subject'),
      nt('marketplaceOrderReady.push.body')
    ),
  ])
  .build();
