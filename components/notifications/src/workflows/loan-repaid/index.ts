import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Возврат займа принят — уведомление пайщику по беспроцентному займу (компонент 73).
export const loanRepaidPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
  repaid: z.string().optional(),
  eventId: z.string().optional(),
});
export type IPayload = z.infer<typeof loanRepaidPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanRepaid.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'vozvrat-zayma-prinyat';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanRepaid')
  .description(nt('loanRepaid.description'))
  .payloadSchema(loanRepaidPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-repaid-email', nt('loanRepaid.email.subject'), nt('loanRepaid.email.body')),
    createInAppStep('loan-repaid-inapp', nt('loanRepaid.inApp.subject'), nt('loanRepaid.inApp.body')),
  ])
  .build();
