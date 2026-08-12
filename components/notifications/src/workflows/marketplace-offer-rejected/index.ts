import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Предложение отклонено модерацией';
export const id = slugify(name);

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
  .description('Уведомление поставщику о том, что его предложение не прошло модерацию, с причиной отказа — карточку нужно поправить и отправить на повторную проверку.')
  .payloadSchema(marketplaceOfferRejectedPayloadSchema)
  .tags(['marketplace', 'offerer', 'offer'])
  .addSteps([
    createEmailStep(
      'marketplace-offer-rejected-email',
      'Предложение не прошло модерацию: {{payload.productName}}',
      'Уважаемый {{payload.supplierName}}!<br><br>Ваше предложение <strong>{{payload.productName}}</strong> не прошло модерацию и в каталоге не показывается.<br><br>Причина: {{payload.reason}}<br><br>Поправьте карточку имущества и отправьте её на повторную проверку: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-offer-rejected-notification',
      'Предложение не прошло модерацию',
      '{{payload.productName}}: {{payload.reason}}'
    ),
    createPushStep(
      'marketplace-offer-rejected-push',
      'Предложение не прошло модерацию',
      '{{payload.productName}}: {{payload.reason}}'
    ),
  ])
  .build();
