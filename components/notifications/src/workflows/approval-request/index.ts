
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Схема для approval-request воркфлоу
export const approvalRequestPayloadSchema = z.object({
  chairmanName: z.string(),
  requestTitle: z.string(),
  requestDescription: z.string(),
  authorName: z.string(),
  coopname: z.string(),
  approval_hash: z.string(),
  approvalUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof approvalRequestPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Запрос на одобрение председателя'
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление председателю совета о новом запросе на одобрение')
  .payloadSchema(approvalRequestPayloadSchema)
  .tags(['chairman']) // Только для председателя
  .addSteps([
    createEmailStep(
      'approval-request-email',
      'Новый запрос на одобрение действия: {{payload.requestTitle}}',
      'Уважаемый {{payload.chairmanName}}!<br><br>Поступил новый запрос на одобрение:<br><br><strong>{{payload.requestTitle}}</strong><br><br>{{payload.requestDescription}}<br><br>Автор запроса: {{payload.authorName}}<br><br>Ссылка для одобрения или отклонения запроса: {{payload.approvalUrl}}'
    ),
    createInAppStep(
      'approval-request-notification',
      'Новый запрос на одобрение действия',
      'Запрос: {{payload.requestTitle}}\nАвтор: {{payload.authorName}}'
    ),
    createPushStep(
      'approval-request-push',
      'Новый запрос на одобрение действия',
      'Запрос: {{payload.requestTitle}} от {{payload.authorName}}'
    ),
  ])
  .build();

