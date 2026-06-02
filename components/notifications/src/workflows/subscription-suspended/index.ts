import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Epic 14 — оповещение пайщику о приостановке сервиса (подписка → suspended).
// Триггерит провайдер (через coopback) в момент перехода фазы 2: grace истёк,
// инстанс отключён до оплаты.
export const subscriptionSuspendedPayloadSchema = z.object({
  coopName: z.string(), // отображаемое имя кооператива-пайщика
  amount: z.string(), // сумма к оплате для восстановления, ₽
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof subscriptionSuspendedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Сервис приостановлен';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Сервис приостановлен из-за неоплаты; восстановление после оплаты')
  .payloadSchema(subscriptionSuspendedPayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep(
      'subscription-suspended-email',
      'Сервис приостановлен',
      'Кооператив «{{payload.coopName}}», ваш инстанс приостановлен из-за неоплаты подписки.<br><br>Чтобы восстановить работу сервиса, оплатите <strong>{{payload.amount}} ₽</strong>.<br><br>После поступления оплаты инстанс будет автоматически возобновлён.<br><br>Подробнее: {{payload.paymentUrl}}'
    ),
    createInAppStep(
      'subscription-suspended-in-app',
      'Сервис приостановлен',
      'Инстанс приостановлен из-за неоплаты. Для восстановления оплатите {{payload.amount}} ₽.'
    ),
    createPushStep(
      'subscription-suspended-push',
      'Сервис приостановлен',
      'Оплатите {{payload.amount}} ₽ для восстановления'
    ),
  ])
  .build();
