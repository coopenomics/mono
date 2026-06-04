import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Epic 14 — оповещение пайщику о просроченной оплате (подписка → past_due).
// Триггерит провайдер (через coopback) в момент перехода фазы 1: срок прошёл,
// сервис ещё работает в течение grace-периода.
export const subscriptionPastDuePayloadSchema = z.object({
  coopName: z.string(), // отображаемое имя кооператива-пайщика
  amount: z.string(), // сумма к оплате, ₽
  graceDays: z.number(), // сколько дней grace-периода до отключения
  suspendDate: z.string(), // дата автоотключения, если не оплатить (локализованная)
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof subscriptionPastDuePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Оплата подписки просрочена';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Оплата подписки просрочена; сервис работает в течение grace-периода')
  .payloadSchema(subscriptionPastDuePayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep(
      'subscription-past-due-email',
      'Оплата подписки просрочена',
      'Кооператив «{{payload.coopName}}», оплата вашей подписки просрочена.<br><br>Сумма к оплате: <strong>{{payload.amount}} ₽</strong>.<br><br>Сервис продолжит работать ещё {{payload.graceDays}} дн. — до {{payload.suspendDate}}. Если оплата не поступит, инстанс будет приостановлен.<br><br>Подробнее: {{payload.paymentUrl}}'
    ),
    createInAppStep(
      'subscription-past-due-in-app',
      'Оплата просрочена',
      'Оплата просрочена. Сервис работает ещё {{payload.graceDays}} дн. (до {{payload.suspendDate}}). Сумма: {{payload.amount}} ₽.'
    ),
    createPushStep(
      'subscription-past-due-push',
      'Оплата просрочена',
      'Сервис работает ещё {{payload.graceDays}} дн. Оплатите {{payload.amount}} ₽'
    ),
  ])
  .build();
