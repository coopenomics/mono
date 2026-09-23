import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceSupplierClaimIssued.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'garantiynaya-pretenziya-postavschiku';

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
  .i18nKey('marketplaceSupplierClaimIssued')
  .description(nt('marketplaceSupplierClaimIssued.description'))
  .payloadSchema(marketplaceSupplierClaimIssuedPayloadSchema)
  .tags(['marketplace', 'offerer'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-claim-issued-email',
      nt('marketplaceSupplierClaimIssued.email.subject'),
      nt('marketplaceSupplierClaimIssued.email.body')
    ),
    createInAppStep(
      'marketplace-supplier-claim-issued-notification',
      nt('marketplaceSupplierClaimIssued.inApp.subject'),
      nt('marketplaceSupplierClaimIssued.inApp.body')
    ),
    createPushStep(
      'marketplace-supplier-claim-issued-push',
      nt('marketplaceSupplierClaimIssued.push.subject'),
      nt('marketplaceSupplierClaimIssued.push.body')
    ),
  ])
  .build();
