import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('subscriptionPaymentDue.name');
// Идентификатор закреплён: на него ссылаются подписки и провайдер
// (billing-workflows.ts). Не менять.
export const id = 'priblizhaetsya-data-oplaty';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('subscriptionPaymentDue')
  .description(nt('subscriptionPaymentDue.description'))
  .payloadSchema(subscriptionPaymentDuePayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep('subscription-payment-due-email', nt('subscriptionPaymentDue.email.subject'), nt('subscriptionPaymentDue.email.body')),
    createInAppStep('subscription-payment-due-in-app', nt('subscriptionPaymentDue.inApp.subject'), nt('subscriptionPaymentDue.inApp.body')),
    createPushStep('subscription-payment-due-push', nt('subscriptionPaymentDue.push.subject'), nt('subscriptionPaymentDue.push.body')),
  ])
  .build();
