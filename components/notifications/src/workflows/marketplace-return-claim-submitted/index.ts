import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceReturnClaimSubmittedPayloadSchema = z.object({
  chairmanName: z.string(),
  ordererName: z.string(),
  brananame: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  reasonExcerpt: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnClaimSubmittedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Новое заявление на гарантийный возврат';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление председателю кооперативного участка о поступившем заявлении на гарантийный возврат имущества пайщиком.')
  .payloadSchema(marketplaceReturnClaimSubmittedPayloadSchema)
  .tags(['marketplace', 'operator', 'return'])
  .addSteps([
    createEmailStep(
      'marketplace-return-claim-submitted-email',
      'Новое заявление на гарантийный возврат от {{payload.ordererName}}',
      'Уважаемый {{payload.chairmanName}}!<br><br>Пайщик <strong>{{payload.ordererName}}</strong> подал заявление на гарантийный возврат имущества по заказу <strong>{{payload.order_id}}</strong> на вашем кооперативном участке <strong>{{payload.brananame}}</strong>.<br><br>Причина: {{payload.reasonExcerpt}}<br><br>Рассмотреть заявление: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-return-claim-submitted-notification',
      'Новое заявление на гарантийный возврат',
      'Пайщик {{payload.ordererName}} подал заявление по заказу {{payload.order_id}} — требуется удалённое рассмотрение.'
    ),
    createPushStep(
      'marketplace-return-claim-submitted-push',
      'Новое заявление на гарантийный возврат',
      'Заявление на гарантийный возврат на КУ {{payload.brananame}} ждёт рассмотрения.'
    ),
  ])
  .build();
