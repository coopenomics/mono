import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceReturnAcceptedSupplierPayloadSchema = z.object({
  supplierName: z.string(),
  kuName: z.string(),
  reasonExcerpt: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnAcceptedSupplierPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Гарантийный возврат принят в кооператив';
export const id = slugify(name);

// Низкая частота, юридически значимо → все три канала. Дальше председатель КУ
// связывается с поставщиком по претензии за пределами системы.
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику о том, что по его товару оформлен гарантийный возврат и имущество принято обратно в кооператив — председатель кооперативного участка свяжется с поставщиком по претензии.')
  .payloadSchema(marketplaceReturnAcceptedSupplierPayloadSchema)
  .tags(['marketplace', 'offerer'])
  .addSteps([
    createEmailStep(
      'marketplace-return-accepted-supplier-email',
      'Гарантийный возврат по вашему товару на КУ {{payload.kuName}}',
      'Уважаемый {{payload.supplierName}}!<br><br>По вашему товару оформлен гарантийный возврат: имущество принято обратно в кооператив на кооперативном участке <strong>{{payload.kuName}}</strong>.<br><br>Причина: {{payload.reasonExcerpt}}<br><br>Председатель кооперативного участка свяжется с вами для урегулирования претензии.<br><br>Подробности: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-return-accepted-supplier-notification',
      'Гарантийный возврат принят',
      'По вашему товару оформлен гарантийный возврат на КУ {{payload.kuName}}. Председатель свяжется с вами по претензии.'
    ),
    createPushStep(
      'marketplace-return-accepted-supplier-push',
      'Гарантийный возврат принят',
      'По вашему товару оформлен возврат на КУ {{payload.kuName}} — председатель свяжется с вами.'
    ),
  ])
  .build();
