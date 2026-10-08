import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Договор займа подписан, платёж передан кассиру — уведомление пайщику по шагу беспроцентного займа (компонент 73).
export const loanSignedPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
});
export type IPayload = z.infer<typeof loanSignedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanSigned.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'dogovor-zayma-podpisan';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanSigned')
  .description(nt('loanSigned.description'))
  .payloadSchema(loanSignedPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-signed-email', nt('loanSigned.email.subject'), nt('loanSigned.email.body')),
    createInAppStep('loan-signed-inapp', nt('loanSigned.inApp.subject'), nt('loanSigned.inApp.body')),
  ])
  .build();
