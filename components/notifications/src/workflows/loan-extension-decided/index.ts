import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Решение о продлении срока возврата займа — уведомление пайщику по беспроцентному займу (компонент 73).
export const loanExtensionDecidedPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
  decision: z.string().optional(),
  reason: z.string().optional(),
});
export type IPayload = z.infer<typeof loanExtensionDecidedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanExtensionDecided.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'reshenie-o-prodlenii-sroka-zayma';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanExtensionDecided')
  .description(nt('loanExtensionDecided.description'))
  .payloadSchema(loanExtensionDecidedPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-extension-decided-email', nt('loanExtensionDecided.email.subject'), nt('loanExtensionDecided.email.body')),
    createInAppStep('loan-extension-decided-inapp', nt('loanExtensionDecided.inApp.subject'), nt('loanExtensionDecided.inApp.body')),
  ])
  .build();
