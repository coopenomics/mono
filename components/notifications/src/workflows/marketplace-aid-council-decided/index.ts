import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceAidCouncilDecidedPayloadSchema = z.object({
  memberName: z.string(),
  amount: z.string(),
  /** Готовая фраза исхода — ветвление в теле шага Центром уведомлений не вычисляется. */
  outcomeHuman: z.string(),
  reasonSuffix: z.string().optional(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceAidCouncilDecidedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Решение совета по материальной помощи';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление пайщику о решении совета по его заявлению на выплату материальной помощи — одобрено с передачей кассиру либо отклонено.')
  .payloadSchema(marketplaceAidCouncilDecidedPayloadSchema)
  .tags(['marketplace', 'member'])
  .addSteps([
    createEmailStep(
      'marketplace-aid-council-decided-email',
      'Решение совета по заявлению на материальную помощь',
      'Уважаемый {{payload.memberName}}!<br><br>Совет рассмотрел ваше заявление на выплату материальной помощи в размере <strong>{{payload.amount}}</strong>.<br><br>{{payload.outcomeHuman}}{{payload.reasonSuffix}}<br><br>Мои средства: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-aid-council-decided-notification',
      'Решение совета по материальной помощи',
      '{{payload.outcomeHuman}} Сумма: {{payload.amount}}.{{payload.reasonSuffix}}'
    ),
    createPushStep(
      'marketplace-aid-council-decided-push',
      'Решение совета',
      '{{payload.outcomeHuman}} {{payload.amount}}.'
    ),
  ])
  .build();
