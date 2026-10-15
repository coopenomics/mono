import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceNewSupplierRequestPayloadSchema = z.object({
  chairmanName: z.string(),
  supplierName: z.string(),
  contractNumber: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceNewSupplierRequestPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceNewSupplierRequest.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'novaya-zayavka-postavschika-na-dopusk';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceNewSupplierRequest')
  .description(nt('marketplaceNewSupplierRequest.description'))
  .payloadSchema(marketplaceNewSupplierRequestPayloadSchema)
  .tags(['marketplace', 'admin'])
  .addSteps([
    createEmailStep(
      'marketplace-new-supplier-request-email',
      nt('marketplaceNewSupplierRequest.email.subject'),
      nt('marketplaceNewSupplierRequest.email.body')
    ),
    createInAppStep(
      'marketplace-new-supplier-request-notification',
      nt('marketplaceNewSupplierRequest.inApp.subject'),
      nt('marketplaceNewSupplierRequest.inApp.body')
    ),
    createPushStep(
      'marketplace-new-supplier-request-push',
      nt('marketplaceNewSupplierRequest.push.subject'),
      nt('marketplaceNewSupplierRequest.push.body')
    ),
  ])
  .build();
