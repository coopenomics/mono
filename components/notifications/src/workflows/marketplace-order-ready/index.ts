import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Заказ готов к получению';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику-заказчику о том, что его заказ принят кооперативом и готов к получению на кооперативном участке.')
  .payloadSchema(marketplaceOrderReadyPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-order-ready-email',
      'Ваш заказ готов к получению на КУ {{payload.kuName}}',
      'Уважаемый {{payload.ordererName}}!<br><br>Ваш заказ принят кооперативом и готов к выдаче на кооперативном участке <strong>{{payload.kuName}}</strong>.<br><br>Приходите на пункт выдачи и предъявите оператору номер заказа: <strong>{{payload.order_id}}</strong>.{{payload.passportReminder}}<br><br>Подробности заказа: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-order-ready-notification',
      'Заказ готов к получению',
      'Ваш заказ на КУ {{payload.kuName}} ждёт получения — приходите на пункт выдачи.{{payload.passportReminder}}'
    ),
    createPushStep(
      'marketplace-order-ready-push',
      'Заказ готов к получению',
      'Ваш заказ на КУ {{payload.kuName}} ждёт вас на пункте выдачи.{{payload.passportReminder}}'
    ),
  ])
  .build();
