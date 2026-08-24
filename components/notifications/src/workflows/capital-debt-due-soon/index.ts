import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalDebtDueSoonPayloadSchema = z.object({
  borrowerName: z.string(),
  amount: z.string(),
  dueDate: z.string(),
  daysLeft: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalDebtDueSoonPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Срок возврата займа подходит';
export const id = slugify(name);

/**
 * Напоминание пайщику до наступления срока.
 *
 * Заём закрывается возвратом денег или сдачей результата — и то и другое
 * требует времени. Узнать о сроке в день его наступления поздно.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Напоминание пайщику о приближении срока возврата займа — с суммой и датой.')
  .payloadSchema(capitalDebtDueSoonPayloadSchema)
  .tags(['capital', 'participant', 'debt'])
  .addSteps([
    createEmailStep(
      'capital-debt-due-soon-email',
      'Срок возврата займа: {{payload.dueDate}}',
      'Уважаемый {{payload.borrowerName}}!<br><br>Срок возврата займа на сумму <strong>{{payload.amount}}</strong> наступает {{payload.dueDate}} — осталось дней: {{payload.daysLeft}}.<br><br>Заём закрывается возвратом денег или сдачей результата по компоненту.<br><br>Открыть заём: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-debt-due-soon-notification',
      'Срок возврата займа подходит',
      '{{payload.amount}} — вернуть до {{payload.dueDate}}'
    ),
    createPushStep(
      'capital-debt-due-soon-push',
      'Срок возврата займа подходит',
      '{{payload.amount}} — осталось дней: {{payload.daysLeft}}'
    ),
  ])
  .build();
