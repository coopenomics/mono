import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Новое предложение на модерации';
export const id = slugify(name);

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
  .description('Уведомление администратору Стола заказов о предложении, поступившем на модерацию — нужно проверить карточку имущества и допустить её в каталог либо отклонить с причиной.')
  .payloadSchema(marketplaceOfferOnModerationPayloadSchema)
  .tags(['marketplace', 'admin', 'offer'])
  .addSteps([
    createEmailStep(
      'marketplace-offer-on-moderation-email',
      'Новое предложение на модерации: {{payload.productName}}',
      'Уважаемый {{payload.recipientName}}!<br><br>Поставщик <strong>{{payload.supplierName}}</strong> отправил на модерацию предложение <strong>{{payload.productName}}</strong>.<br><br>До вашего решения предложение не показывается в каталоге. Проверьте карточку имущества и допустите её в каталог либо отклоните с указанием причины: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-offer-on-moderation-notification',
      'Новое предложение на модерации',
      '{{payload.supplierName}}: {{payload.productName}} — ждёт проверки.'
    ),
    createPushStep(
      'marketplace-offer-on-moderation-push',
      'Новое предложение на модерации',
      '{{payload.productName}} от {{payload.supplierName}} ждёт проверки.'
    ),
  ])
  .build();
