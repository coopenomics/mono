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

export const name = 'Срок доступа к курсу заканчивается';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Заблаговременное предупреждение пайщику: оплаченный период подходит к концу, без следующего взноса доступ будет отозван.')
  .payloadSchema(payloadSchema)
  .tags(['edubridge', 'member'])
  .addSteps([
    createEmailStep('edubridge-access-expiring-email', 'Срок доступа к курсу заканчивается', 'Оплаченный период доступа {{payload.learnerName}} к курсу «{{payload.courseTitle}}» заканчивается {{payload.paidUntil}}.<br><br>Чтобы доступ не прервался, продлите подписку: {{payload.deepLinkUrl}}'),
    createInAppStep('edubridge-access-expiring-notification', 'Срок доступа к курсу заканчивается', 'Доступ {{payload.learnerName}} к курсу «{{payload.courseTitle}}» заканчивается {{payload.paidUntil}} — продлите подписку.'),
    createPushStep('edubridge-access-expiring-push', 'Срок доступа к курсу заканчивается', 'Доступ к «{{payload.courseTitle}}» заканчивается {{payload.paidUntil}}.'),
  ])
  .build();
