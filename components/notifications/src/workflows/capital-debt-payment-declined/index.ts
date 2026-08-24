import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const capitalDebtPaymentDeclinedPayloadSchema = z.object({
  borrowerName: z.string(),
  amount: z.string(),
  reason: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof capitalDebtPaymentDeclinedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Платёж по займу не прошёл';
export const id = slugify(name);

/**
 * Банк не принял платёж по реквизитам.
 *
 * Решение совета остаётся в силе — платёж отправят повторно. Пайщику важно
 * знать, что деньги задержались не из-за отказа кооператива, и поправить
 * реквизиты, если дело в них.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление о том, что платёж по займу не прошёл по реквизитам; решение совета остаётся в силе и платёж отправят повторно.')
  .payloadSchema(capitalDebtPaymentDeclinedPayloadSchema)
  .tags(['capital', 'participant', 'debt'])
  .addSteps([
    createEmailStep(
      'capital-debt-payment-declined-email',
      'Платёж по займу не прошёл',
      'Уважаемый {{payload.borrowerName}}!<br><br>Платёж по займу на сумму <strong>{{payload.amount}}</strong> не прошёл.<br>Причина: {{payload.reason}}<br><br>Решение совета остаётся в силе — платёж отправят повторно. Если дело в реквизитах, поправьте их в личном кабинете.<br><br>Открыть заём: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'capital-debt-payment-declined-notification',
      'Платёж по займу не прошёл',
      '{{payload.amount}}: {{payload.reason}}'
    ),
    createPushStep(
      'capital-debt-payment-declined-push',
      'Платёж по займу не прошёл',
      '{{payload.reason}}'
    ),
  ])
  .build();
