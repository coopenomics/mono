import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceAplSupplierSignRequestPayloadSchema = z.object({
  supplierName: z.string(),
  kuName: z.string(),
  ttnNumber: z.string(),
  expeditorName: z.string(),
  coopname: z.string(),
  apl_reception_id: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceAplSupplierSignRequestPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceAplSupplierSignRequest.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'akt-priyomki-ekspeditorom-ozhidaet-podpisi-postavschika';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceAplSupplierSignRequest')
  .description(nt('marketplaceAplSupplierSignRequest.description'))
  .payloadSchema(marketplaceAplSupplierSignRequestPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-apl-supplier-sign-request-email',
      nt('marketplaceAplSupplierSignRequest.email.subject'),
      nt('marketplaceAplSupplierSignRequest.email.body')
    ),
    createInAppStep(
      'marketplace-apl-supplier-sign-request-notification',
      nt('marketplaceAplSupplierSignRequest.inApp.subject'),
      nt('marketplaceAplSupplierSignRequest.inApp.body')
    ),
    createPushStep(
      'marketplace-apl-supplier-sign-request-push',
      nt('marketplaceAplSupplierSignRequest.push.subject'),
      nt('marketplaceAplSupplierSignRequest.push.body')
    ),
  ])
  .build();
