import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для new-initial-payment-request воркфлоу
export const newInitialPaymentRequestPayloadSchema = z.object({
  chairmanName: z.string(),
  participantName: z.string(),
  paymentAmount: z.string(),
  paymentCurrency: z.string(),
  paymentType: z.string(),
  coopname: z.string(),
  paymentUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof newInitialPaymentRequestPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('newInitialPaymentRequest.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'novaya-zayavka-na-vstupitelniy-vznos';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('newInitialPaymentRequest')
  .description(nt('newInitialPaymentRequest.description'))
  .payloadSchema(newInitialPaymentRequestPayloadSchema)
  .tags(['chairman']) // Только для председателя
  .addSteps([
    createEmailStep(
      'new-initial-payment-request-email',
      nt('newInitialPaymentRequest.email.subject'),
      nt('newInitialPaymentRequest.email.body')
    ),
    createInAppStep(
      'new-initial-payment-request-notification',
      nt('newInitialPaymentRequest.inApp.subject'),
      nt('newInitialPaymentRequest.inApp.body')
    ),
    createPushStep(
      'new-initial-payment-request-push',
      nt('newInitialPaymentRequest.push.subject'),
      nt('newInitialPaymentRequest.push.body')
    ),
  ])
  .build();
