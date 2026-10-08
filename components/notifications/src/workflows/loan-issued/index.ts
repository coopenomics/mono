import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Беспроцентный заём выдан — уведомление пайщику по шагу беспроцентного займа (компонент 73).
export const loanIssuedPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
});
export type IPayload = z.infer<typeof loanIssuedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanIssued.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'zaym-vydan';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanIssued')
  .description(nt('loanIssued.description'))
  .payloadSchema(loanIssuedPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-issued-email', nt('loanIssued.email.subject'), nt('loanIssued.email.body')),
    createInAppStep('loan-issued-inapp', nt('loanIssued.inApp.subject'), nt('loanIssued.inApp.body')),
  ])
  .build();
