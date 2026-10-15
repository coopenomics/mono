import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceOfferApprovedPayloadSchema = z.object({
  supplierName: z.string(),
  productName: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceOfferApprovedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceOfferApproved.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'predlozhenie-proshlo-moderatsiyu';

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
  .i18nKey('marketplaceOfferApproved')
  .description(nt('marketplaceOfferApproved.description'))
  .payloadSchema(marketplaceOfferApprovedPayloadSchema)
  .tags(['marketplace', 'offerer', 'offer'])
  .addSteps([
    createEmailStep(
      'marketplace-offer-approved-email',
      nt('marketplaceOfferApproved.email.subject'),
      nt('marketplaceOfferApproved.email.body')
    ),
    createInAppStep(
      'marketplace-offer-approved-notification',
      nt('marketplaceOfferApproved.inApp.subject'),
      nt('marketplaceOfferApproved.inApp.body')
    ),
    createPushStep(
      'marketplace-offer-approved-push',
      nt('marketplaceOfferApproved.push.subject'),
      nt('marketplaceOfferApproved.push.body')
    ),
  ])
  .build();
