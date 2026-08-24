import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalDebtOverduePayloadSchema = z.object({
  borrowerName: z.string(),
  amount: z.string(),
  dueDate: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalDebtOverduePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Срок возврата займа прошёл';
export const id = slugify(name);

/**
 * Срок возврата истёк.
 *
 * Просрочка ничего не отнимает у пайщика: заём по-прежнему закрывается
 * возвратом денег или сдачей результата. Но кооператив видит такие займы
 * отдельно, поэтому пайщику лучше узнать об этом первым.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику о том, что срок возврата займа прошёл и заём числится просроченным.')
  .payloadSchema(capitalDebtOverduePayloadSchema)
  .tags(['capital', 'participant', 'debt'])
  .addSteps([
    createEmailStep(
      'capital-debt-overdue-email',
      'Срок возврата займа прошёл',
      'Уважаемый {{payload.borrowerName}}!<br><br>Срок возврата займа на сумму <strong>{{payload.amount}}</strong> истёк {{payload.dueDate}}.<br><br>Заём можно закрыть возвратом денег или сдачей результата по компоненту.<br><br>Открыть заём: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-debt-overdue-notification',
      'Срок возврата займа прошёл',
      '{{payload.amount}} — срок истёк {{payload.dueDate}}'
    ),
    createPushStep(
      'capital-debt-overdue-push',
      'Срок возврата займа прошёл',
      '{{payload.amount}} — заём числится просроченным'
    ),
  ])
  .build();
