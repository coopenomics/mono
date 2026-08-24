import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalRoleRequestedPayloadSchema = z.object({
  masterName: z.string(),
  applicantName: z.string(),
  componentName: z.string(),
  roleName: z.string(),
  ratePerHour: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalRoleRequestedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Заявка на допуск к работе';
export const id = slugify(name);

/**
 * Пайщик просит допуск к роли на компоненте.
 *
 * Решение принимает мастер компонента, и до его решения пайщик не может
 * начать работу. Без уведомления заявка лежит незамеченной, а пайщик ждёт.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление мастеру компонента о заявке пайщика на допуск к работе — с указанием роли и желаемой ставки часа.')
  .payloadSchema(capitalRoleRequestedPayloadSchema)
  .tags(['capital', 'master', 'role'])
  .addSteps([
    createEmailStep(
      'capital-role-requested-email',
      'Заявка на допуск: {{payload.componentName}}',
      'Уважаемый {{payload.masterName}}!<br><br>{{payload.applicantName}} просит допуск к работе на компоненте <strong>{{payload.componentName}}</strong>.<br>Роль: {{payload.roleName}}<br>Желаемая ставка часа: {{payload.ratePerHour}}<br><br>Рассмотреть заявку: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-role-requested-notification',
      'Заявка на допуск',
      '{{payload.applicantName}} просит допуск на компоненте {{payload.componentName}}.'
    ),
    createPushStep(
      'capital-role-requested-push',
      'Заявка на допуск',
      '{{payload.applicantName}} — {{payload.componentName}}'
    ),
  ])
  .build();
