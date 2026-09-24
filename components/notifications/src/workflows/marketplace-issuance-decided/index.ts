import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceIssuanceDecided.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sovet-reshil-po-vydache-imuschestva';

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
  .i18nKey('marketplaceIssuanceDecided')
  .description(nt('marketplaceIssuanceDecided.description'))
  .payloadSchema(marketplaceIssuanceDecidedPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-issuance-decided-email',
      nt('marketplaceIssuanceDecided.email.subject'),
      nt('marketplaceIssuanceDecided.email.body')
    ),
    createInAppStep(
      'marketplace-issuance-decided-notification',
      nt('marketplaceIssuanceDecided.inApp.subject'),
      nt('marketplaceIssuanceDecided.inApp.body')
    ),
    createPushStep(
      'marketplace-issuance-decided-push',
      nt('marketplaceIssuanceDecided.push.subject'),
      nt('marketplaceIssuanceDecided.push.body')
    ),
  ])
  .build();
