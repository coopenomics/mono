import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const payloadSchema = z.object({
  learnerName: z.string(),
  courseTitle: z.string(),
  paidUntil: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof payloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Доступ к курсу открыт';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику: членский взнос принят, доступ обучающегося на площадке выдан.')
  .payloadSchema(payloadSchema)
  .tags(['edubridge', 'member'])
  .addSteps([
    createEmailStep('edubridge-access-granted-email', 'Доступ к курсу открыт', 'Членский взнос принят. Для {{payload.learnerName}} открыт доступ к курсу «{{payload.courseTitle}}» до {{payload.paidUntil}}.<br><br>Приглашение отправлено на указанный адрес. Моё обучение: {{payload.deepLinkUrl}}'),
    createInAppStep('edubridge-access-granted-notification', 'Доступ к курсу открыт', 'Для {{payload.learnerName}} открыт доступ к курсу «{{payload.courseTitle}}» до {{payload.paidUntil}}.'),
    createPushStep('edubridge-access-granted-push', 'Доступ к курсу открыт', 'Доступ к курсу «{{payload.courseTitle}}» открыт до {{payload.paidUntil}}.'),
  ])
  .build();
