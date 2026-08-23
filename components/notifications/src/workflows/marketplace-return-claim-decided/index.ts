import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceReturnClaimDecidedPayloadSchema = z.object({
  ordererName: z.string(),
  decisionHuman: z.string(),
  brananame: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  comment: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnClaimDecidedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Решение по заявлению на гарантийный возврат';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику-заказчику о решении, принятом на пункте выдачи по его заявлению на гарантийный возврат (одобрение очного визита / отказ удалённо). Решение принимает оператор пункта выдачи — председатель участка либо его доверенное лицо.')
  .payloadSchema(marketplaceReturnClaimDecidedPayloadSchema)
  .tags(['marketplace', 'orderer', 'return'])
  .addSteps([
    createEmailStep(
      'marketplace-return-claim-decided-email',
      'Решение по вашему заявлению на возврат: {{payload.decisionHuman}}',
      'Уважаемый {{payload.ordererName}}!<br><br>На пункте выдачи <strong>{{payload.brananame}}</strong> принято решение по вашему заявлению на гарантийный возврат по заказу <strong>{{payload.order_id}}</strong>: <strong>{{payload.decisionHuman}}</strong>.<br><br>Комментарий: {{payload.comment}}<br><br>Подробности заявления: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-return-claim-decided-notification',
      'Решение по заявлению на возврат',
      'По вашему заявлению: {{payload.decisionHuman}} — {{payload.comment}}'
    ),
    createPushStep(
      'marketplace-return-claim-decided-push',
      'Решение по заявлению на возврат',
      '{{payload.decisionHuman}}: {{payload.comment}}'
    ),
  ])
  .build();
