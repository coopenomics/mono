import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceOfferOnModerationPayloadSchema = z.object({
  // Имя получателя — администратора стола заказов: карточки имущества проверяет
  // и допускает в каталог именно он (право `Offer:moderate` в роли admin).
  recipientName: z.string(),
  supplierName: z.string(),
  productName: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceOfferOnModerationPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceOfferOnModeration.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'novoe-predlozhenie-na-moderatsii';

/**
 * Предложение поставщика встало в очередь модерации.
 *
 * До этого уведомления не было вовсе: предложение уходило на модерацию молча, и
 * администратор узнавал о нём, только если сам открывал стол. Поставщик всё это
 * время ждал допуска в каталог, не понимая, что заявку никто не видел.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceOfferOnModeration')
  .description(nt('marketplaceOfferOnModeration.description'))
  .payloadSchema(marketplaceOfferOnModerationPayloadSchema)
  .tags(['marketplace', 'admin', 'offer'])
  .addSteps([
    createEmailStep(
      'marketplace-offer-on-moderation-email',
      nt('marketplaceOfferOnModeration.email.subject'),
      nt('marketplaceOfferOnModeration.email.body')
    ),
    createInAppStep(
      'marketplace-offer-on-moderation-notification',
      nt('marketplaceOfferOnModeration.inApp.subject'),
      nt('marketplaceOfferOnModeration.inApp.body')
    ),
    createPushStep(
      'marketplace-offer-on-moderation-push',
      nt('marketplaceOfferOnModeration.push.subject'),
      nt('marketplaceOfferOnModeration.push.body')
    ),
  ])
  .build();
