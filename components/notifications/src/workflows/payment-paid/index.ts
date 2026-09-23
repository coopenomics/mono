
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для payment-completed воркфлоу
export const paymentCompletedPayloadSchema = z.object({
  userName: z.string(),
  paymentAmount: z.string(),
  paymentCurrency: z.string(),
  paymentDate: z.string(),
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof paymentCompletedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('paymentPaid.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'platezh-prinyat';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('paymentPaid')
  .description(nt('paymentPaid.description'))
  .payloadSchema(paymentCompletedPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'payment-completed-email',
      nt('paymentPaid.email.subject'),
      nt('paymentPaid.email.body')
    ),
    createInAppStep(
      'payment-completed-notification',
      nt('paymentPaid.inApp.subject'),
      nt('paymentPaid.inApp.body')
    ),
    createPushStep(
      'payment-completed-push',
      nt('paymentPaid.push.subject'),
      nt('paymentPaid.push.body')
    ),
  ])
  .build();

