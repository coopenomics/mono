import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceSupplierApprovedPayloadSchema = z.object({
  supplierName: z.string(),
  contractNumber: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceSupplierApprovedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Заявка поставщика на допуск одобрена';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику об одобрении заявки на допуск — открыт доступ в личный кабинет Стола поставщика.')
  .payloadSchema(marketplaceSupplierApprovedPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-supplier-approved-email',
      'Заявка на допуск поставщика одобрена',
      'Уважаемый {{payload.supplierName}}!<br><br>Ваша заявка на допуск поставщика по договору № {{payload.contractNumber}} одобрена председателем кооператива.<br><br>Вам открыт доступ в личный кабинет Стола поставщика — теперь вы можете публиковать предложения и принимать заказы: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-supplier-approved-notification',
      'Допуск поставщика одобрен',
      'Заявка по договору № {{payload.contractNumber}} одобрена. Открыт доступ в личный кабинет Стола поставщика.'
    ),
    createPushStep(
      'marketplace-supplier-approved-push',
      'Допуск поставщика одобрен',
      'Открыт доступ в личный кабинет Стола поставщика.'
    ),
  ])
  .build();
