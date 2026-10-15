import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Epic 14 — напоминание пайщику о скором окончании пробного периода подписки.
// Триггерит провайдер (через coopback) за T-7/T-3/T-1 до конца TRIAL.
export const trialEndingPayloadSchema = z.object({
  coopName: z.string(), // отображаемое имя кооператива-пайщика
  daysLeft: z.number(), // сколько дней до конца триала (7/3/1)
  trialEndDate: z.string(), // дата окончания триала (локализованная)
  amount: z.string(), // сумма первой оплаты, ₽
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof trialEndingPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('trialEnding.name');
// Идентификатор закреплён: на него ссылаются подписки и провайдер
// (billing-workflows.ts). Не менять.
export const id = 'probniy-period-zakanchivaetsya';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('trialEnding')
  .description(nt('trialEnding.description'))
  .payloadSchema(trialEndingPayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep('trial-ending-email', nt('trialEnding.email.subject'), nt('trialEnding.email.body')),
    createInAppStep('trial-ending-in-app', nt('trialEnding.inApp.subject'), nt('trialEnding.inApp.body')),
    createPushStep('trial-ending-push', nt('trialEnding.push.subject'), nt('trialEnding.push.body')),
  ])
  .build();
