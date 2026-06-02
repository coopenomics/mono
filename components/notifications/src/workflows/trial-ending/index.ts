import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Пробный период заканчивается';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Напоминание о скором окончании пробного периода и предстоящей первой оплате')
  .payloadSchema(trialEndingPayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep(
      'trial-ending-email',
      'Пробный период скоро закончится',
      'Кооператив «{{payload.coopName}}», пробный период вашего инстанса заканчивается через {{payload.daysLeft}} дн. ({{payload.trialEndDate}}).<br><br>Чтобы сервис продолжил работу, потребуется первая оплата на сумму <strong>{{payload.amount}} ₽</strong>.<br><br>Подробнее: {{payload.paymentUrl}}'
    ),
    createInAppStep(
      'trial-ending-in-app',
      'Пробный период заканчивается',
      'Через {{payload.daysLeft}} дн. закончится пробный период. Первая оплата — {{payload.amount}} ₽.'
    ),
    createPushStep(
      'trial-ending-push',
      'Пробный период заканчивается',
      'Через {{payload.daysLeft}} дн. — первая оплата {{payload.amount}} ₽'
    ),
  ])
  .build();
