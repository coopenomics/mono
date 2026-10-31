import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

/**
 * Пайщику после ежемесячного списания обеспечительной части паевого взноса
 * в членский взнос по условиям ЦПП «Стол заказов» (задача 99D-18). Одно письмо
 * на пайщика за прогон и только если списана сумма больше нуля. Позже в это
 * письмо войдут сведения о коэффициенте экономического участия и о части,
 * возвращённой пайщику.
 */
export const marketplaceSecurePartChargedPayloadSchema = z.object({
  userName: z.string(),
  /** Списанная сумма за прогон, с валютой. */
  amount: z.string(),
  /** Число заказов, по которым прошло списание. */
  ordersCount: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceSecurePartChargedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceSecurePartCharged.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'obespechitelnaya-chast-spisana';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceSecurePartCharged')
  .description(nt('marketplaceSecurePartCharged.description'))
  .payloadSchema(marketplaceSecurePartChargedPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-secure-part-charged-email',
      nt('marketplaceSecurePartCharged.email.subject'),
      nt('marketplaceSecurePartCharged.email.body')
    ),
    createInAppStep(
      'marketplace-secure-part-charged-notification',
      nt('marketplaceSecurePartCharged.inApp.subject'),
      nt('marketplaceSecurePartCharged.inApp.body')
    ),
    createPushStep(
      'marketplace-secure-part-charged-push',
      nt('marketplaceSecurePartCharged.push.subject'),
      nt('marketplaceSecurePartCharged.push.body')
    ),
  ])
  .build();
