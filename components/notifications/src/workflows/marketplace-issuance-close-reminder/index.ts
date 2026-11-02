import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

/**
 * Напоминание оператору участка (99D-18): пайщик подписал акт выдачи, а
 * закрывающей подписи оператора нет больше часа. Пока выдача не закрыта,
 * обеспечительная часть не переходит к списанию. Отправляется один раз.
 */
export const marketplaceIssuanceCloseReminderPayloadSchema = z.object({
  operatorName: z.string(),
  memberName: z.string(),
  /** Название выдаваемого имущества. */
  productName: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  /**
   * Заказ, выдача которого ждёт закрывающей подписи. По этому признаку
   * рабочий стол ведёт из колокольчика на стол выдачи.
   */
  closeIssuanceOrderId: z.string(),
  /** Ссылка на стол выдачи — для письма и push. */
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceIssuanceCloseReminderPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceIssuanceCloseReminder.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'vydacha-zhdyot-zakryvayuschey-podpisi';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceIssuanceCloseReminder')
  .description(nt('marketplaceIssuanceCloseReminder.description'))
  .payloadSchema(marketplaceIssuanceCloseReminderPayloadSchema)
  .tags(['marketplace', 'operator'])
  .addSteps([
    createEmailStep(
      'marketplace-issuance-close-reminder-email',
      nt('marketplaceIssuanceCloseReminder.email.subject'),
      nt('marketplaceIssuanceCloseReminder.email.body')
    ),
    createInAppStep(
      'marketplace-issuance-close-reminder-notification',
      nt('marketplaceIssuanceCloseReminder.inApp.subject'),
      nt('marketplaceIssuanceCloseReminder.inApp.body')
    ),
    createPushStep(
      'marketplace-issuance-close-reminder-push',
      nt('marketplaceIssuanceCloseReminder.push.subject'),
      nt('marketplaceIssuanceCloseReminder.push.body')
    ),
  ])
  .build();
