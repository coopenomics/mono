
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('paymentRefunded.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'platyozh-vypolnen';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('paymentRefunded')
  .description(nt('paymentRefunded.description'))
  .payloadSchema(paymentRefundedPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'payment-refunded-email',
      nt('paymentRefunded.email.subject'),
      nt('paymentRefunded.email.body')
    ),
    createInAppStep(
      'payment-refunded-notification',
      nt('paymentRefunded.inApp.subject'),
      nt('paymentRefunded.inApp.body')
    ),
    createPushStep(
      'payment-refunded-push',
      nt('paymentRefunded.push.subject'),
      nt('paymentRefunded.push.body')
    ),
  ])
  .build();
