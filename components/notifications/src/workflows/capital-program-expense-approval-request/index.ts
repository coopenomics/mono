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

export const name = 'Запрос на одобрение расхода программы';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Председатель: поступил расход программы на одобрение')
  .payloadSchema(payloadSchema)
  .tags(['chairman', 'capital'])
  .addSteps([
    createEmailStep(
      'capital-program-expense-approval-request-email',
      'Запрос на одобрение расхода программы: {{payload.title}}',
      'Уважаемый {{payload.recipientName}}!<br><br>Председатель: поступил расход программы на одобрение<br><br><strong>{{payload.title}}</strong><br>Сумма: {{payload.amount}}<br>{{payload.description}}<br><br>{% if payload.url %}<a href="{{payload.url}}">Перейти</a>{% endif %}'
    ),
    createInAppStep(
      'capital-program-expense-approval-request-inapp',
      'Запрос на одобрение расхода программы',
      '{{payload.title}} — {{payload.amount}}'
    ),
    createPushStep(
      'capital-program-expense-approval-request-push',
      'Запрос на одобрение расхода программы',
      '{{payload.title}}'
    ),
  ])
  .build();
