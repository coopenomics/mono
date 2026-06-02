import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const payloadSchema = z.object({
  recipientName: z.string(),
  coopname: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  amount: z.string().optional().default(''),
  actorName: z.string().optional().default(''),
  url: z.string().optional().default(''),
});

export type IPayload = z.infer<typeof payloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Скоро срок возврата займа';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Напоминание о приближающемся сроке возврата займа')
  .payloadSchema(payloadSchema)
  .tags(['participant', 'capital'])
  .addSteps([
    createEmailStep(
      'capital-debt-due-soon-email',
      'Скоро срок возврата займа: {{payload.title}}',
      'Уважаемый {{payload.recipientName}}!<br><br>Напоминание о приближающемся сроке возврата займа<br><br><strong>{{payload.title}}</strong><br>Сумма: {{payload.amount}}<br>{{payload.description}}<br><br>{% if payload.url %}<a href="{{payload.url}}">Перейти</a>{% endif %}'
    ),
    createInAppStep(
      'capital-debt-due-soon-inapp',
      'Скоро срок возврата займа',
      '{{payload.title}} — {{payload.amount}}'
    ),
    createPushStep(
      'capital-debt-due-soon-push',
      'Скоро срок возврата займа',
      '{{payload.title}}'
    ),
  ])
  .build();
