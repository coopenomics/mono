import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

export const marketplaceReturnClaimFinalizedPayloadSchema = z.object({
  ordererName: z.string(),
  outcomeHuman: z.string(),
  coopname: z.string(),
  claim_id: z.string(),
  order_id: z.string(),
  returnedAmount: z.string().optional(),
  /**
   * Готовый суффикс для in-app/push («` — 100,00 ₽ восстановлены`» либо
   * пустая строка) — считается на бэкенде, а не через `{% if %}` в теле
   * шага. Liquid-условия в in_app/pushControlValues Центром уведомлений не
   * вычисляются (тег остаётся как есть в тексте) — только email-шаблоны
   * (`editorType: 'html'`) идут через полноценный рендер (review 2026-07-28).
   */
  returnedAmountSuffix: z.string().default(''),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReturnClaimFinalizedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Гарантийный возврат завершён';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Финальное уведомление заказчику о результате гарантийного возврата (принят с восстановлением средств / отказ).')
  .payloadSchema(marketplaceReturnClaimFinalizedPayloadSchema)
  .tags(['marketplace', 'orderer', 'return'])
  .addSteps([
    createEmailStep(
      'marketplace-return-claim-finalized-email',
      'Гарантийный возврат завершён: {{payload.outcomeHuman}}',
      'Уважаемый {{payload.ordererName}}!<br><br>Ваш гарантийный возврат по заказу <strong>{{payload.order_id}}</strong> завершён: <strong>{{payload.outcomeHuman}}</strong>.{% if payload.returnedAmount %}<br><br>На программный кошелёк восстановлено: <strong>{{payload.returnedAmount}} ₽</strong> — вы можете направить их на следующий заказ либо вывести в общий членский кошелёк.{% endif %}<br><br>Детали возврата: {{payload.deepLinkUrl}}'
    ),
    createInAppStep(
      'marketplace-return-claim-finalized-notification',
      'Гарантийный возврат завершён',
      '{{payload.outcomeHuman}}{{payload.returnedAmountSuffix}}.'
    ),
    createPushStep(
      'marketplace-return-claim-finalized-push',
      'Гарантийный возврат завершён',
      '{{payload.outcomeHuman}}{{payload.returnedAmountSuffix}}.'
    ),
  ])
  .build();
