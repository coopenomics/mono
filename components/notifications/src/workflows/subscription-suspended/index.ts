import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('subscriptionSuspended.name');
// Идентификатор закреплён: на него ссылаются подписки и провайдер
// (billing-workflows.ts). Не менять.
export const id = 'servis-priostanovlen';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('subscriptionSuspended')
  .description(nt('subscriptionSuspended.description'))
  .payloadSchema(subscriptionSuspendedPayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep('subscription-suspended-email', nt('subscriptionSuspended.email.subject'), nt('subscriptionSuspended.email.body')),
    createInAppStep('subscription-suspended-in-app', nt('subscriptionSuspended.inApp.subject'), nt('subscriptionSuspended.inApp.body')),
    createPushStep('subscription-suspended-push', nt('subscriptionSuspended.push.subject'), nt('subscriptionSuspended.push.body')),
  ])
  .build();
