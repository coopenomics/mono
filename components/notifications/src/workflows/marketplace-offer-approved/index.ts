import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceOfferApprovedPayloadSchema = z.object({
  supplierName: z.string(),
  productName: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceOfferApprovedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Предложение прошло модерацию';
export const id = slugify(name);

/**
 * Предложение допущено в каталог.
 *
 * Поставщику это событие важнее всех прочих: до одобрения его имущество не
 * видно заказчикам, и без уведомления он не знает, можно ли рассчитывать на
 * заказы. Раньше приходилось самому открывать стол и проверять статус.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику о том, что его предложение прошло модерацию и опубликовано в каталоге — по нему можно принимать заказы.')
  .payloadSchema(marketplaceOfferApprovedPayloadSchema)
  .tags(['marketplace', 'offerer', 'offer'])
  .addSteps([
    createEmailStep(
      'marketplace-offer-approved-email',
      'Предложение прошло модерацию: {{payload.productName}}',
      'Уважаемый {{payload.supplierName}}!<br><br>Ваше предложение <strong>{{payload.productName}}</strong> прошло модерацию и опубликовано в каталоге — заказчики уже могут его заказать.<br><br>Открыть предложение: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-offer-approved-notification',
      'Предложение опубликовано',
      '{{payload.productName}} прошло модерацию и появилось в каталоге.'
    ),
    createPushStep(
      'marketplace-offer-approved-push',
      'Предложение опубликовано',
      '{{payload.productName}} прошло модерацию — предложение в каталоге.'
    ),
  ])
  .build();
