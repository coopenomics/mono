import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceIssuanceDecidedPayloadSchema = z.object({
  ordererName: z.string(),
  kuName: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  /** Текст исхода: «Совет принял решение…» либо «Совет отказал…» — подставляет отправитель. */
  outcomeText: z.string(),
  /** Что делать дальше: «подпишите акт в приложении» либо «обратитесь на участок». */
  nextStepText: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceIssuanceDecidedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Совет решил по выдаче имущества';
export const id = slugify(name);

/**
 * Паевая модель Стола заказов: совет рассмотрел заявление о возврате паевого
 * взноса имуществом не сразу (робот не настроен или кворум набирали люди), и
 * пайщика у стойки уже нет. Уведомление зовёт его подписать акт в приложении
 * и прийти за имуществом — или сообщает об отказе.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику-заказчику о решении совета по выдаче имущества, принятом после его ухода с пункта выдачи.')
  .payloadSchema(marketplaceIssuanceDecidedPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-issuance-decided-email',
      'Решение совета по вашему заказу на КУ {{payload.kuName}}',
      'Уважаемый {{payload.ordererName}}!<br><br>{{payload.outcomeText}}<br><br>{{payload.nextStepText}}<br><br>Заказ: <strong>{{payload.order_id}}</strong>, участок <strong>{{payload.kuName}}</strong>.<br><br>Открыть заказ: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-issuance-decided-notification',
      'Решение совета по выдаче',
      '{{payload.outcomeText}} {{payload.nextStepText}}'
    ),
    createPushStep(
      'marketplace-issuance-decided-push',
      'Решение совета по выдаче',
      '{{payload.outcomeText}} {{payload.nextStepText}}'
    ),
  ])
  .build();
