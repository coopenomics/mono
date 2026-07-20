
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Схема исходящего платежа пайщику. Это НЕ обязательно возврат взноса — тем же
// каналом идут оплата аванса под отчёт, доплата по перерасходу и пр., поэтому
// текст универсальный «Платёж выполнен», без привязки к типу платежа.
export const paymentRefundedPayloadSchema = z.object({
  userName: z.string(),
  paymentAmount: z.string(),
  paymentCurrency: z.string(),
  paymentDate: z.string(),
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof paymentRefundedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Платёж выполнен';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление о выполненном исходящем платеже пайщику (аванс, возврат, доплата и пр.)')
  .payloadSchema(paymentRefundedPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'payment-refunded-email',
      'Платёж выполнен',
      'Уважаемый {{payload.userName}}!<br><br>Вам выполнен платёж.<br><br>Сумма: <strong>{{payload.paymentAmount}} {{payload.paymentCurrency}}</strong><br><br>Дата: {{payload.paymentDate}}<br><br>Подробная информация доступна по ссылке: {{payload.paymentUrl}}'
    ),
    createInAppStep(
      'payment-refunded-notification',
      'Платёж выполнен',
      'Платёж на сумму {{payload.paymentAmount}} {{payload.paymentCurrency}} выполнен'
    ),
    createPushStep(
      'payment-refunded-push',
      'Платёж выполнен',
      'Платёж {{payload.paymentAmount}} {{payload.paymentCurrency}} выполнен'
    ),
  ])
  .build();
