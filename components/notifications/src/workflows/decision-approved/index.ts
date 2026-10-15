
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для decision-approved воркфлоу
export const decisionApprovedPayloadSchema = z.object({
  userName: z.string(),
  decisionTitle: z.string(),
  coopname: z.string(),
  decision_id: z.string(),
  decisionUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof decisionApprovedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('decisionApproved.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'reshenie-soveta-prinyato';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('decisionApproved')
  .description(nt('decisionApproved.description'))
  .payloadSchema(decisionApprovedPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'decision-approved-email',
      nt('decisionApproved.email.subject'),
      nt('decisionApproved.email.body')
    ),
    createInAppStep(
      'decision-approved-notification',
      nt('decisionApproved.inApp.subject'),
      nt('decisionApproved.inApp.body')
    ),
    createPushStep(
      'decision-approved-push',
      nt('decisionApproved.push.subject'),
      nt('decisionApproved.push.body')
    ),
  ])
  .build();

