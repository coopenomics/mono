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

export const name = 'Расход программы одобрен';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Совет: расход программы одобрен председателем, требуется авторизация')
  .payloadSchema(payloadSchema)
  .tags(['council-member', 'capital'])
  .addSteps([
    createEmailStep(
      'capital-program-expense-approved-email',
      'Расход программы одобрен: {{payload.title}}',
      'Уважаемый {{payload.recipientName}}!<br><br>Совет: расход программы одобрен председателем, требуется авторизация<br><br><strong>{{payload.title}}</strong><br>Сумма: {{payload.amount}}<br>{{payload.description}}<br><br>{% if payload.url %}<a href="{{payload.url}}">Перейти</a>{% endif %}'
    ),
    createInAppStep(
      'capital-program-expense-approved-inapp',
      'Расход программы одобрен',
      '{{payload.title}} — {{payload.amount}}'
    ),
    createPushStep(
      'capital-program-expense-approved-push',
      'Расход программы одобрен',
      '{{payload.title}}'
    ),
  ])
  .build();
