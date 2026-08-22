import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceNewSupplierRequestPayloadSchema = z.object({
  chairmanName: z.string(),
  supplierName: z.string(),
  contractNumber: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceNewSupplierRequestPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Новая заявка поставщика на допуск';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление председателю о новой заявке пайщика на допуск поставщика — нужно рассмотреть и одобрить либо отклонить в реестре поставщиков.')
  .payloadSchema(marketplaceNewSupplierRequestPayloadSchema)
  .tags(['marketplace', 'admin'])
  .addSteps([
    createEmailStep(
      'marketplace-new-supplier-request-email',
      'Новая заявка поставщика: {{payload.supplierName}}',
      'Уважаемый {{payload.chairmanName}}!<br><br>Пайщик <strong>{{payload.supplierName}}</strong> подал заявку на допуск поставщика по договору № {{payload.contractNumber}}.<br><br>Откройте реестр поставщиков, чтобы рассмотреть заявку — одобрить или отклонить: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-new-supplier-request-notification',
      'Новая заявка поставщика',
      '{{payload.supplierName}} ожидает рассмотрения (договор № {{payload.contractNumber}}).'
    ),
    createPushStep(
      'marketplace-new-supplier-request-push',
      'Новая заявка поставщика',
      '{{payload.supplierName}}: договор № {{payload.contractNumber}}.'
    ),
  ])
  .build();
