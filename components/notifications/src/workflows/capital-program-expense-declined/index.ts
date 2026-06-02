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

export const name = 'Расход программы отклонён';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление об отклонении расхода программы')
  .payloadSchema(payloadSchema)
  .tags(['participant', 'capital'])
  .addSteps([
    createEmailStep(
      'capital-program-expense-declined-email',
      'Расход программы отклонён: {{payload.title}}',
      'Уважаемый {{payload.recipientName}}!<br><br>Уведомление об отклонении расхода программы<br><br><strong>{{payload.title}}</strong><br>Сумма: {{payload.amount}}<br>{{payload.description}}<br><br>{% if payload.url %}<a href="{{payload.url}}">Перейти</a>{% endif %}'
    ),
    createInAppStep(
      'capital-program-expense-declined-inapp',
      'Расход программы отклонён',
      '{{payload.title}} — {{payload.amount}}'
    ),
    createPushStep(
      'capital-program-expense-declined-push',
      'Расход программы отклонён',
      '{{payload.title}}'
    ),
  ])
  .build();
