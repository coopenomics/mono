import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceSupplierClaimIssuedPayloadSchema = z.object({
  supplierName: z.string(),
  kuName: z.string(),
  amount: z.string(),
  reasonExcerpt: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceSupplierClaimIssuedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Гарантийная претензия поставщику';
export const id = slugify(name);

/**
 * Задача 99D-13: по решению совета об отмене сделки поставщику выставлена
 * гарантийная претензия — рекламация пайщика в две подписи, имущество ждёт на
 * участке, сумма к признанию или отказу. Низкая частота, юридически значимо →
 * все три канала. Ответ поставщик даёт в разделе «Гарантийные возвраты».
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику о гарантийной претензии по его товару: имущество возвращено пайщиком и принято кооперативом, поставщику предлагается признать претензию или отказать.')
  .payloadSchema(marketplaceSupplierClaimIssuedPayloadSchema)
  .tags(['marketplace', 'offerer'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-claim-issued-email',
      'Гарантийная претензия на {{payload.amount}} по вашему товару',
      'Уважаемый {{payload.supplierName}}!<br><br>По вашему товару оформлен гарантийный возврат: пайщик вернул имущество, кооператив принял его на участке <strong>{{payload.kuName}}</strong> и по решению совета отменил сделку. Вам выставлена гарантийная претензия на <strong>{{payload.amount}}</strong>.<br><br>Причина: {{payload.reasonExcerpt}}<br><br>Откройте раздел «Гарантийные возвраты» на своём столе: там рекламация с подписями пайщика и оператора, фотографии и кнопки «Согласен» и «Не согласен». Если вы согласны, сумма будет удержана из ваших следующих выплат; если нет — свяжитесь с участком {{payload.kuName}}, там же можно забрать имущество.<br><br>Подробности: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-supplier-claim-issued-notification',
      'Гарантийная претензия на {{payload.amount}}',
      'По вашему товару оформлен гарантийный возврат на участке {{payload.kuName}}. Ответьте по претензии в разделе «Гарантийные возвраты».'
    ),
    createPushStep(
      'marketplace-supplier-claim-issued-push',
      'Гарантийная претензия на {{payload.amount}}',
      'Возврат по вашему товару на участке {{payload.kuName}} — ответьте в разделе «Гарантийные возвраты».'
    ),
  ])
  .build();
