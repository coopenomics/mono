import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceOfferRejectedPayloadSchema = z.object({
  supplierName: z.string(),
  productName: z.string(),
  // Причина отказа обязательна: без неё поставщик не знает, что исправлять, и
  // отправляет карточку на повторную модерацию в том же виде.
  reason: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceOfferRejectedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceOfferRejected.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'predlozhenie-otkloneno-moderatsiey';

/**
 * Предложение не допущено в каталог.
 *
 * Парный случай к одобрению, и без него отказ выглядит как молчание: карточка
 * просто остаётся невидимой в каталоге. Поставщику нужна причина — по ней он
 * правит карточку и отправляет её на повторную проверку.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceOfferRejected')
  .description(nt('marketplaceOfferRejected.description'))
  .payloadSchema(marketplaceOfferRejectedPayloadSchema)
  .tags(['marketplace', 'offerer', 'offer'])
  .addSteps([
    createEmailStep(
      'marketplace-offer-rejected-email',
      nt('marketplaceOfferRejected.email.subject'),
      nt('marketplaceOfferRejected.email.body')
    ),
    createInAppStep(
      'marketplace-offer-rejected-notification',
      nt('marketplaceOfferRejected.inApp.subject'),
      nt('marketplaceOfferRejected.inApp.body')
    ),
    createPushStep(
      'marketplace-offer-rejected-push',
      nt('marketplaceOfferRejected.push.subject'),
      nt('marketplaceOfferRejected.push.body')
    ),
  ])
  .build();
