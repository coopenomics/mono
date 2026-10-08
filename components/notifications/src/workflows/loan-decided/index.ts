import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Решение совета по беспроцентному займу — уведомление пайщику по шагу беспроцентного займа (компонент 73).
export const loanDecidedPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
  decision: z.string(),
  reason: z.string(),
});
export type IPayload = z.infer<typeof loanDecidedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanDecided.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'reshenie-soveta-po-zaymu';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanDecided')
  .description(nt('loanDecided.description'))
  .payloadSchema(loanDecidedPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-decided-email', nt('loanDecided.email.subject'), nt('loanDecided.email.body')),
    createInAppStep('loan-decided-inapp', nt('loanDecided.inApp.subject'), nt('loanDecided.inApp.body')),
  ])
  .build();
