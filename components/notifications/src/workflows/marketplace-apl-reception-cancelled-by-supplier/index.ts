import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Поставщик отменил приёмку на ПВЗ';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description(
    'Уведомление оператору ПВЗ, который сформировал акт приёмки: поставщик у стойки отказался подписывать и отменил черновик. Нужно повторить приёмку или оформить отказ в приёмке по партии.'
  )
  .payloadSchema(marketplaceAplReceptionCancelledBySupplierPayloadSchema)
  .tags(['marketplace', 'operator'])
  .addSteps([
    createInAppStep(
      'marketplace-apl-reception-cancelled-by-supplier-notification',
      'Поставщик отменил приёмку',
      '{{payload.supplierName}} не подтвердил приёмку на КУ {{payload.kuName}}. Повторите приёмку или оформите отказ в приёмке по партии.'
    ),
    createPushStep(
      'marketplace-apl-reception-cancelled-by-supplier-push',
      'Поставщик отменил приёмку',
      '{{payload.supplierName}} на КУ {{payload.kuName}}: повторите приёмку или оформите отказ.'
    ),
  ])
  .build();
