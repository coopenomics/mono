import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Epic 14 — напоминание пайщику о приближающейся дате оплаты подписки.
// Триггерит провайдер (через coopback) за T-7/T-3/T-1 до next_payment_due.
export const subscriptionPaymentDuePayloadSchema = z.object({
  coopName: z.string(), // отображаемое имя кооператива-пайщика
  daysLeft: z.number(), // сколько дней до даты оплаты (7/3/1/0)
  dueDate: z.string(), // дата оплаты (локализованная)
  amount: z.string(), // сумма к оплате, ₽
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof subscriptionPaymentDuePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Приближается дата оплаты';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Напоминание о приближающейся дате оплаты подписки')
  .payloadSchema(subscriptionPaymentDuePayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep(
      'subscription-payment-due-email',
      'Приближается дата оплаты подписки',
      'Кооператив «{{payload.coopName}}», срок оплаты вашей подписки наступает через {{payload.daysLeft}} дн. ({{payload.dueDate}}).<br><br>Сумма к оплате: <strong>{{payload.amount}} ₽</strong>.<br><br>Чтобы сервис не прерывался, оплатите до указанной даты.<br><br>Подробнее: {{payload.paymentUrl}}'
    ),
    createInAppStep(
      'subscription-payment-due-in-app',
      'Приближается дата оплаты',
      'Через {{payload.daysLeft}} дн. — оплата подписки на сумму {{payload.amount}} ₽.'
    ),
    createPushStep(
      'subscription-payment-due-push',
      'Приближается дата оплаты',
      'Через {{payload.daysLeft}} дн. — оплата {{payload.amount}} ₽'
    ),
  ])
  .build();
