
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для payment-cancelled воркфлоу
export const paymentCancelledPayloadSchema = z.object({
  userName: z.string(),
  paymentAmount: z.string(),
  paymentCurrency: z.string(),
  paymentId: z.string(),
  paymentDate: z.string(),
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof paymentCancelledPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('paymentCancelled.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'platezh-otmenen';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('paymentCancelled')
  .description(nt('paymentCancelled.description'))
  .payloadSchema(paymentCancelledPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'payment-cancelled-email',
      nt('paymentCancelled.email.subject'),
      nt('paymentCancelled.email.body')
    ),
    createInAppStep(
      'payment-cancelled-notification',
      nt('paymentCancelled.inApp.subject'),
      nt('paymentCancelled.inApp.body')
    ),
    createPushStep(
      'payment-cancelled-push',
      nt('paymentCancelled.push.subject'),
      nt('paymentCancelled.push.body')
    ),
  ])
  .build();

