import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Срок возврата займа подходит — уведомление пайщику по беспроцентному займу (компонент 73).
export const loanDueSoonPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
  // Вид займа: под паевой взнос (share) или под коммиты (generation) — от него зависит текст.
  kind: z.string().optional(),
});
export type IPayload = z.infer<typeof loanDueSoonPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanDueSoon.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'srok-vozvrata-zayma-podhodit';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanDueSoon')
  .description(nt('loanDueSoon.description'))
  .payloadSchema(loanDueSoonPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-due-soon-email', nt('loanDueSoon.email.subject'), nt('loanDueSoon.email.body')),
    createInAppStep('loan-due-soon-inapp', nt('loanDueSoon.inApp.subject'), nt('loanDueSoon.inApp.body')),
  ])
  .build();
