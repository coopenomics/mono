import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Платёж по займу отклонён — уведомление пайщику по шагу беспроцентного займа (компонент 73).
export const loanPaymentDeclinedPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
  reason: z.string(),
});
export type IPayload = z.infer<typeof loanPaymentDeclinedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanPaymentDeclined.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'platyozh-po-zaymu-ne-proshyol';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanPaymentDeclined')
  .description(nt('loanPaymentDeclined.description'))
  .payloadSchema(loanPaymentDeclinedPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-payment-declined-email', nt('loanPaymentDeclined.email.subject'), nt('loanPaymentDeclined.email.body')),
    createInAppStep('loan-payment-declined-inapp', nt('loanPaymentDeclined.inApp.subject'), nt('loanPaymentDeclined.inApp.body')),
  ])
  .build();
