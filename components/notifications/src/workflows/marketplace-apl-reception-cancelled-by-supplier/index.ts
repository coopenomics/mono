import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceAplReceptionCancelledBySupplierPayloadSchema = z.object({
  operatorName: z.string(),
  supplierName: z.string(),
  kuName: z.string(),
  coopname: z.string(),
  apl_reception_id: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceAplReceptionCancelledBySupplierPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceAplReceptionCancelledBySupplier.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'postavschik-otmenil-priyomku-na-pvz';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceAplReceptionCancelledBySupplier')
  .description(
    nt('marketplaceAplReceptionCancelledBySupplier.description')
  )
  .payloadSchema(marketplaceAplReceptionCancelledBySupplierPayloadSchema)
  .tags(['marketplace', 'operator'])
  .addSteps([
    createInAppStep(
      'marketplace-apl-reception-cancelled-by-supplier-notification',
      nt('marketplaceAplReceptionCancelledBySupplier.inApp.subject'),
      nt('marketplaceAplReceptionCancelledBySupplier.inApp.body')
    ),
    createPushStep(
      'marketplace-apl-reception-cancelled-by-supplier-push',
      nt('marketplaceAplReceptionCancelledBySupplier.push.subject'),
      nt('marketplaceAplReceptionCancelledBySupplier.push.body')
    ),
  ])
  .build();
