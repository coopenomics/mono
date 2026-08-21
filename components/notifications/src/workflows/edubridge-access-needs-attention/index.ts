import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const payloadSchema = z.object({
  courseTitle: z.string(),
  reason: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof payloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Выдача доступа требует вмешательства';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление владельцу приложения: задача выдачи или отзыва доступа не выполнена автоматически — площадка отказала или курс рассогласован.')
  .payloadSchema(payloadSchema)
  .tags(['edubridge', 'owner'])
  .addSteps([
    createEmailStep('edubridge-access-needs-attention-email', 'Выдача доступа требует вмешательства', 'Задача выдачи доступа по курсу «{{payload.courseTitle}}» требует вмешательства: {{payload.reason}}.<br><br>Очередь выдачи: {{payload.deepLinkUrl}}'),
    createInAppStep('edubridge-access-needs-attention-notification', 'Выдача доступа требует вмешательства', 'Курс «{{payload.courseTitle}}»: {{payload.reason}}'),
    createPushStep('edubridge-access-needs-attention-push', 'Выдача доступа требует вмешательства', 'Выдача доступа требует вмешательства: {{payload.reason}}'),
  ])
  .build();
