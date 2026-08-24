import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalRoleDeclinedPayloadSchema = z.object({
  applicantName: z.string(),
  componentName: z.string(),
  reason: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalRoleDeclinedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Отказ по заявке на допуск';
export const id = slugify(name);

/**
 * Мастер отказал по заявке.
 *
 * Причина отказа приходит вместе с уведомлением: пайщику важно понимать,
 * что поправить, чтобы подать заявку заново.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику об отказе мастера по заявке на допуск к работе или на изменение ставки часа — с причиной отказа.')
  .payloadSchema(capitalRoleDeclinedPayloadSchema)
  .tags(['capital', 'participant', 'role'])
  .addSteps([
    createEmailStep(
      'capital-role-declined-email',
      'Отказ по заявке: {{payload.componentName}}',
      'Уважаемый {{payload.applicantName}}!<br><br>Мастер компонента <strong>{{payload.componentName}}</strong> отказал по вашей заявке.<br>Причина: {{payload.reason}}<br><br>Открыть компонент: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-role-declined-notification',
      'Отказ по заявке',
      '{{payload.componentName}}: {{payload.reason}}'
    ),
    createPushStep(
      'capital-role-declined-push',
      'Отказ по заявке',
      '{{payload.componentName}} — {{payload.reason}}'
    ),
  ])
  .build();
