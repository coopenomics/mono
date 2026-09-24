import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('marketplaceAidCouncilDecided.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'reshenie-soveta-po-materialnoy-pomoschi';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceAidCouncilDecided')
  .description(nt('marketplaceAidCouncilDecided.description'))
  .payloadSchema(marketplaceAidCouncilDecidedPayloadSchema)
  .tags(['marketplace', 'member'])
  .addSteps([
    createEmailStep(
      'marketplace-aid-council-decided-email',
      nt('marketplaceAidCouncilDecided.email.subject'),
      nt('marketplaceAidCouncilDecided.email.body')
    ),
    createInAppStep(
      'marketplace-aid-council-decided-notification',
      nt('marketplaceAidCouncilDecided.inApp.subject'),
      nt('marketplaceAidCouncilDecided.inApp.body')
    ),
    createPushStep(
      'marketplace-aid-council-decided-push',
      nt('marketplaceAidCouncilDecided.push.subject'),
      nt('marketplaceAidCouncilDecided.push.body')
    ),
  ])
  .build();
