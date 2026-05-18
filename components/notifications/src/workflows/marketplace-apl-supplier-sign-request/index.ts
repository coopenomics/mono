import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Акт приёмки экспедитором ожидает подписи поставщика';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление поставщику о новом акте приёмки экспедитором (вариант Б) — требуется первая подпись поставщика, чтобы оператор смог провести закрывающую подпись.')
  .payloadSchema(marketplaceAplSupplierSignRequestPayloadSchema)
  .tags(['marketplace', 'supplier'])
  .addSteps([
    createEmailStep(
      'marketplace-apl-supplier-sign-request-email',
      'Требуется ваша подпись акта приёмки на КУ {{payload.kuName}}',
      'Уважаемый {{payload.supplierName}}!<br><br>Экспедитор <strong>{{payload.expeditorName}}</strong> сдал партию по ТТН <strong>{{payload.ttnNumber}}</strong> на КУ <strong>{{payload.kuName}}</strong>.<br><br>Чтобы оператор мог завершить приёмку и обеспечить выплату по партии, нужна ваша первая подпись акта приёмки.<br><br>Открыть акт: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-apl-supplier-sign-request-notification',
      'Акт приёмки ожидает вашей подписи',
      'Партия по ТТН {{payload.ttnNumber}} принята на КУ {{payload.kuName}}. Подпишите акт, чтобы оператор завершил приёмку.'
    ),
    createPushStep(
      'marketplace-apl-supplier-sign-request-push',
      'Акт приёмки ждёт подписи',
      'ТТН {{payload.ttnNumber}} на КУ {{payload.kuName}}: требуется ваша подпись.'
    ),
  ])
  .build();
