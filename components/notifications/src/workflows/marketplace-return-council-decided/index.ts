import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceReturnCouncilDecidedPayloadSchema = z.object({
  ordererName: z.string(),
  kuName: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  /** Текст исхода: имущество принято и паевой взнос восстановлен, либо совет отказал. */
  outcomeText: z.string(),
  /** Что делать дальше: ничего / прийти забрать имущество на участке. */
  nextStepText: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnCouncilDecidedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceReturnCouncilDecided.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sovet-reshil-po-garantiynomu-vozvratu';

/**
 * Паевая модель Стола заказов: оператор принял имущество у стойки и подал в
 * совет заявление об отмене сделки, совет его рассмотрел. При согласии сделка
 * отменена, паевой и членский взносы восстановлены; при отказе имущество ждёт
 * пайщика на участке.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceReturnCouncilDecided')
  .description(nt('marketplaceReturnCouncilDecided.description'))
  .payloadSchema(marketplaceReturnCouncilDecidedPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-return-council-decided-email',
      nt('marketplaceReturnCouncilDecided.email.subject'),
      nt('marketplaceReturnCouncilDecided.email.body')
    ),
    createInAppStep(
      'marketplace-return-council-decided-notification',
      nt('marketplaceReturnCouncilDecided.inApp.subject'),
      nt('marketplaceReturnCouncilDecided.inApp.body')
    ),
    createPushStep(
      'marketplace-return-council-decided-push',
      nt('marketplaceReturnCouncilDecided.push.subject'),
      nt('marketplaceReturnCouncilDecided.push.body')
    ),
  ])
  .build();
