import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalRoleApprovedPayloadSchema = z.object({
  applicantName: z.string(),
  componentName: z.string(),
  roleName: z.string(),
  approvedRatePerHour: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalRoleApprovedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Допуск к работе одобрен';
export const id = slugify(name);

/**
 * Мастер одобрил допуск и утвердил ставку часа.
 *
 * С этого момента пайщик может вносить работу по компоненту, а его час
 * оценивается утверждённой ставкой — она и попадает в стоимость работы.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику о том, что мастер компонента допустил его к работе и утвердил ставку часа.')
  .payloadSchema(capitalRoleApprovedPayloadSchema)
  .tags(['capital', 'participant', 'role'])
  .addSteps([
    createEmailStep(
      'capital-role-approved-email',
      'Допуск одобрен: {{payload.componentName}}',
      'Уважаемый {{payload.applicantName}}!<br><br>Мастер компонента <strong>{{payload.componentName}}</strong> допустил вас к работе.<br>Роль: {{payload.roleName}}<br>Утверждённая ставка часа: {{payload.approvedRatePerHour}}<br><br>Открыть компонент: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-role-approved-notification',
      'Допуск одобрен',
      '{{payload.componentName}} — ставка {{payload.approvedRatePerHour}}'
    ),
    createPushStep(
      'capital-role-approved-push',
      'Допуск одобрен',
      '{{payload.componentName}} — можно вносить работу.'
    ),
  ])
  .build();
