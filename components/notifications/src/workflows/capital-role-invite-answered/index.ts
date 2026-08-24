import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalRoleInviteAnsweredPayloadSchema = z.object({
  masterName: z.string(),
  candidateName: z.string(),
  componentName: z.string(),
  answer: z.string(),
  reason: z.string().optional(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalRoleInviteAnsweredPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Ответ на приглашение к работе';
export const id = slugify(name);

/**
 * Пайщик принял приглашение или отказался.
 *
 * Мастеру нужен ответ, чтобы понимать, кем закрыт компонент, и звать
 * следующего, если приглашённый отказался.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление мастеру компонента о том, что приглашённый пайщик принял приглашение к работе или отказался от него.')
  .payloadSchema(capitalRoleInviteAnsweredPayloadSchema)
  .tags(['capital', 'master', 'role'])
  .addSteps([
    createEmailStep(
      'capital-role-invite-answered-email',
      'Ответ на приглашение: {{payload.componentName}}',
      'Уважаемый {{payload.masterName}}!<br><br>{{payload.candidateName}} — {{payload.answer}} приглашение к работе на компоненте <strong>{{payload.componentName}}</strong>.<br>{% if payload.reason %}Причина: {{payload.reason}}{% endif %}<br><br>Открыть компонент: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-role-invite-answered-notification',
      'Ответ на приглашение',
      '{{payload.candidateName}} — {{payload.answer}} ({{payload.componentName}})'
    ),
    createPushStep(
      'capital-role-invite-answered-push',
      'Ответ на приглашение',
      '{{payload.candidateName}} — {{payload.answer}}'
    ),
  ])
  .build();
