import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceReturnCouncilDecidedPayloadSchema = z.object({
  ordererName: z.string(),
  kuName: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  /** Текст исхода: имущество принято и паевой взнос восстановлен, либо совет отказал. */
  outcomeText: z.string(),
  /** Что делать дальше: ничего / прийти забрать имущество на участке. */
  nextStepText: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnCouncilDecidedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Совет решил по гарантийному возврату';
export const id = slugify(name);

/**
 * Паевая модель Стола заказов: оператор принял имущество у стойки, совет
 * рассмотрел заявление о внесении паевого взноса имуществом. При согласии
 * паевой взнос восстановлен; при отказе имущество ждёт пайщика на участке.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику-заказчику о решении совета по гарантийному возврату имущества.')
  .payloadSchema(marketplaceReturnCouncilDecidedPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-return-council-decided-email',
      'Решение совета по гарантийному возврату (заказ {{payload.order_id}})',
      'Уважаемый {{payload.ordererName}}!<br><br>{{payload.outcomeText}}<br><br>{{payload.nextStepText}}<br><br>Участок: <strong>{{payload.kuName}}</strong>.<br><br>Подробности: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-return-council-decided-notification',
      'Решение совета по возврату',
      '{{payload.outcomeText}} {{payload.nextStepText}}'
    ),
    createPushStep(
      'marketplace-return-council-decided-push',
      'Решение совета по возврату',
      '{{payload.outcomeText}} {{payload.nextStepText}}'
    ),
  ])
  .build();
