import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Обеспечение займа обращено в пользу кооператива — уведомление пайщику по беспроцентному займу (компонент 73).
export const loanWrittenOffPayloadSchema = z.object({
  coopName: z.string(),
  contractNumber: z.string(),
  amount: z.string(),
  dueAt: z.string(),
  link: z.string(),
  seized: z.string().optional(),
  eventId: z.string().optional(),
});
export type IPayload = z.infer<typeof loanWrittenOffPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loanWrittenOff.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'obespechenie-zayma-spisano';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loanWrittenOff')
  .description(nt('loanWrittenOff.description'))
  .payloadSchema(loanWrittenOffPayloadSchema)
  .tags(['debt', 'financial'])
  .addSteps([
    createEmailStep('loan-written-off-email', nt('loanWrittenOff.email.subject'), nt('loanWrittenOff.email.body')),
    createInAppStep('loan-written-off-inapp', nt('loanWrittenOff.inApp.subject'), nt('loanWrittenOff.inApp.body')),
  ])
  .build();
