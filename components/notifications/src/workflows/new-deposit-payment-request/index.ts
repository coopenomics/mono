import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для new-deposit-payment-request воркфлоу
export const newDepositPaymentRequestPayloadSchema = z.object({
  chairmanName: z.string(),
  participantName: z.string(),
  paymentAmount: z.string(),
  paymentCurrency: z.string(),
  paymentType: z.string(),
  coopname: z.string(),
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof newDepositPaymentRequestPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('newDepositPaymentRequest.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'novaya-novaya-zayavka-na-paevoy-vznos';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('newDepositPaymentRequest')
  .description(nt('newDepositPaymentRequest.description'))
  .payloadSchema(newDepositPaymentRequestPayloadSchema)
  .tags(['chairman']) // Только для председателя
  .addSteps([
    createEmailStep(
      'new-deposit-payment-request-email',
      nt('newDepositPaymentRequest.email.subject'),
      nt('newDepositPaymentRequest.email.body')
    ),
    createInAppStep(
      'new-deposit-payment-request-notification',
      nt('newDepositPaymentRequest.inApp.subject'),
      nt('newDepositPaymentRequest.inApp.body')
    ),
    createPushStep(
      'new-deposit-payment-request-push',
      nt('newDepositPaymentRequest.push.subject'),
      nt('newDepositPaymentRequest.push.body')
    ),
  ])
  .build();
