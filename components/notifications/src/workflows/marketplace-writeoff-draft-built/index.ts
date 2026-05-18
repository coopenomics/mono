import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceWriteoffDraftBuiltPayloadSchema = z.object({
  chairmanName: z.string(),
  coopname: z.string(),
  proposal_id: z.string(),
  trigger: z.string(),
  itemsCount: z.number(),
  totalAmount: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceWriteoffDraftBuiltPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Сформирован черновик проекта списания скоропорта';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description(
    'Уведомление председателю / общему администратору о том, что сформирован новый черновик проекта списания скоропорта — нужно проверить состав и отправить в совет.'
  )
  .payloadSchema(marketplaceWriteoffDraftBuiltPayloadSchema)
  .tags(['marketplace', 'admin', 'writeoff'])
  .addSteps([
    createEmailStep(
      'marketplace-writeoff-draft-built-email',
      'Готов черновик списания на {{payload.itemsCount}} позиций',
      'Здравствуйте, {{payload.chairmanName}}!<br><br>Сформирован черновик проекта списания скоропорта: <strong>{{payload.itemsCount}}</strong> позиций на сумму <strong>{{payload.totalAmount}}</strong>. Источник — {{payload.trigger}}.<br><br>Проверьте состав и подпишите Заявление о списании, чтобы отправить проект в совет: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-writeoff-draft-built-notification',
      'Новый черновик проекта списания',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
    createPushStep(
      'marketplace-writeoff-draft-built-push',
      'Готов черновик списания',
      '{{payload.itemsCount}} позиций — {{payload.totalAmount}}'
    ),
  ])
  .build();
