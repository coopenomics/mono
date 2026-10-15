import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

// Схема payload для письма-подтверждения выхода из кооператива
export const membershipExitConfirmationPayloadSchema = z.object({
  confirmationUrl: z.string(),
});

export type IPayload = z.infer<typeof membershipExitConfirmationPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('membershipExitConfirmation.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'podtverzhdenie-vykhoda-iz-kooperativa';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('membershipExitConfirmation')
  .description(nt('membershipExitConfirmation.description'))
  .payloadSchema(membershipExitConfirmationPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'membership-exit-confirmation-email',
      nt('membershipExitConfirmation.email.subject'),
      nt('membershipExitConfirmation.email.body')
    ),
  ])
  .build();
