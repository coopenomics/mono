import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalRoleInvitedPayloadSchema = z.object({
  candidateName: z.string(),
  masterName: z.string(),
  componentName: z.string(),
  roleName: z.string(),
  ratePerHour: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalRoleInvitedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Приглашение к работе на компоненте';
export const id = slugify(name);

/**
 * Мастер сам зовёт пайщика на роль.
 *
 * Приглашение вступает в силу только после согласия пайщика: ставка часа
 * из приглашения станет его утверждённой ставкой на этом компоненте.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику о приглашении мастера к работе на компоненте — с ролью и предлагаемой ставкой часа.')
  .payloadSchema(capitalRoleInvitedPayloadSchema)
  .tags(['capital', 'participant', 'role'])
  .addSteps([
    createEmailStep(
      'capital-role-invited-email',
      'Приглашение к работе: {{payload.componentName}}',
      'Уважаемый {{payload.candidateName}}!<br><br>{{payload.masterName}} приглашает вас к работе на компоненте <strong>{{payload.componentName}}</strong>.<br>Роль: {{payload.roleName}}<br>Предлагаемая ставка часа: {{payload.ratePerHour}}<br><br>Ответить на приглашение: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-role-invited-notification',
      'Приглашение к работе',
      '{{payload.componentName}} — ставка {{payload.ratePerHour}}'
    ),
    createPushStep(
      'capital-role-invited-push',
      'Приглашение к работе',
      '{{payload.masterName}} зовёт на {{payload.componentName}}'
    ),
  ])
  .build();
