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

export const name = 'Заявка на L2-допуск';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Мастер компонента: поступила заявка на L2-допуск')
  .payloadSchema(payloadSchema)
  .tags(['master', 'capital'])
  .addSteps([
    createEmailStep(
      'capital-role-requested-email',
      'Заявка на L2-допуск: {{payload.title}}',
      'Уважаемый {{payload.recipientName}}!<br><br>Мастер компонента: поступила заявка на L2-допуск<br><br><strong>{{payload.title}}</strong><br>Сумма: {{payload.amount}}<br>{{payload.description}}<br><br>{% if payload.url %}<a href="{{payload.url}}">Перейти</a>{% endif %}'
    ),
    createInAppStep(
      'capital-role-requested-inapp',
      'Заявка на L2-допуск',
      '{{payload.title}} — {{payload.amount}}'
    ),
    createPushStep(
      'capital-role-requested-push',
      'Заявка на L2-допуск',
      '{{payload.title}}'
    ),
  ])
  .build();
