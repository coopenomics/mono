import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const marketplaceReviewInvitePayloadSchema = z.object({
  ordererName: z.string(),
  /** Название полученного имущества. */
  productName: z.string(),
  coopname: z.string(),
  order_id: z.string(),
  /**
   * Заказ, по которому ждут отзыв. По этому признаку рабочий стол ведёт из
   * колокольчика прямо на форму отзыва.
   */
  reviewOrderId: z.string(),
  /** Ссылка на заказ с открытой формой отзыва — для письма и push. */
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceReviewInvitePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceReviewInvite.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'priglashenie-ostavit-otzyv';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceReviewInvite')
  .description(nt('marketplaceReviewInvite.description'))
  .payloadSchema(marketplaceReviewInvitePayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep(
      'marketplace-review-invite-email',
      nt('marketplaceReviewInvite.email.subject'),
      nt('marketplaceReviewInvite.email.body')
    ),
    createInAppStep(
      'marketplace-review-invite-notification',
      nt('marketplaceReviewInvite.inApp.subject'),
      nt('marketplaceReviewInvite.inApp.body')
    ),
    createPushStep(
      'marketplace-review-invite-push',
      nt('marketplaceReviewInvite.push.subject'),
      nt('marketplaceReviewInvite.push.body')
    ),
  ])
  .build();
