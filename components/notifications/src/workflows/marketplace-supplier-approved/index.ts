import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceSupplierApprovedPayloadSchema = z.object({
  supplierName: z.string(),
  contractNumber: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceSupplierApprovedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceSupplierApproved.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'zayavka-postavschika-na-dopusk-odobrena';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceSupplierApproved')
  .description(nt('marketplaceSupplierApproved.description'))
  .payloadSchema(marketplaceSupplierApprovedPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-approved-email',
      nt('marketplaceSupplierApproved.email.subject'),
      nt('marketplaceSupplierApproved.email.body')
    ),
    createInAppStep(
      'marketplace-supplier-approved-notification',
      nt('marketplaceSupplierApproved.inApp.subject'),
      nt('marketplaceSupplierApproved.inApp.body')
    ),
    createPushStep(
      'marketplace-supplier-approved-push',
      nt('marketplaceSupplierApproved.push.subject'),
      nt('marketplaceSupplierApproved.push.body')
    ),
  ])
  .build();
