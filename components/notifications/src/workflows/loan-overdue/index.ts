import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Срок возврата займа прошёл — уведомление пайщику по беспроцентному займу (компонент 73).
export const loanOverduePayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
});
export type IPayload = z.infer<typeof loanOverduePayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanOverdue.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'srok-vozvrata-zayma-proshyol';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanOverdue')
  .description(nt('loanOverdue.description'))
  .payloadSchema(loanOverduePayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-overdue-email', nt('loanOverdue.email.subject'), nt('loanOverdue.email.body')),
    createInAppStep('loan-overdue-inapp', nt('loanOverdue.inApp.subject'), nt('loanOverdue.inApp.body')),
  ])
  .build();
