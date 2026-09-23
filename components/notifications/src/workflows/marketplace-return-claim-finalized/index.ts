import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceReturnClaimFinalizedPayloadSchema = z.object({
  ordererName: z.string(),
  outcomeHuman: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  returnedAmount: z.string().optional(),
  /**
   * Готовый суффикс для in-app/push («` — 100,00 ₽ восстановлены`» либо пустая
   * строка) — считается на бэкенде.
   *
   * Условия в теле шага тоже допустимы: Центр уведомлений рендерит Liquid во всех
   * каналах одинаково. До 2026-08-27 не рендерил ни в одном (теги уезжали в текст
   * буквально), и предыдущая редакция этого примечания ошибочно считала, что email
   * идёт через полноценный рендер, — отсюда и предвычисленный суффикс.
   */
  returnedAmountSuffix: z.string().default(''),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnClaimFinalizedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceReturnClaimFinalized.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'garantiyniy-vozvrat-zavershyon';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceReturnClaimFinalized')
  .description(nt('marketplaceReturnClaimFinalized.description'))
  .payloadSchema(marketplaceReturnClaimFinalizedPayloadSchema)
  .tags(['marketplace', 'orderer', 'return'])
  .addSteps([
    createEmailStep(
      'marketplace-return-claim-finalized-email',
      nt('marketplaceReturnClaimFinalized.email.subject'),
      nt('marketplaceReturnClaimFinalized.email.body')
    ),
    createInAppStep(
      'marketplace-return-claim-finalized-notification',
      nt('marketplaceReturnClaimFinalized.inApp.subject'),
      nt('marketplaceReturnClaimFinalized.inApp.body')
    ),
    createPushStep(
      'marketplace-return-claim-finalized-push',
      nt('marketplaceReturnClaimFinalized.push.subject'),
      nt('marketplaceReturnClaimFinalized.push.body')
    ),
  ])
  .build();
