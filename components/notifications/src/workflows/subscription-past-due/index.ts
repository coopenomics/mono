import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('subscriptionPastDue.name');
// Идентификатор закреплён: на него ссылаются подписки и провайдер
// (billing-workflows.ts). Не менять.
export const id = 'oplata-podpiski-prosrochena';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('subscriptionPastDue')
  .description(nt('subscriptionPastDue.description'))
  .payloadSchema(subscriptionPastDuePayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep('subscription-past-due-email', nt('subscriptionPastDue.email.subject'), nt('subscriptionPastDue.email.body')),
    createInAppStep('subscription-past-due-in-app', nt('subscriptionPastDue.inApp.subject'), nt('subscriptionPastDue.inApp.body')),
    createPushStep('subscription-past-due-push', nt('subscriptionPastDue.push.subject'), nt('subscriptionPastDue.push.body')),
  ])
  .build();
