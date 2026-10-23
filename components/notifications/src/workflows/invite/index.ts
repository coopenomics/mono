import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

// Схема для invite воркфлоу
export const invitePayloadSchema = z.object({
  inviteUrl: z.string(),
});

export type IPayload = z.infer<typeof invitePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('invite.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'priglashenie-v-kooperativ';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('invite')
  .description(nt('invite.description'))
  .payloadSchema(invitePayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'invite-email',
      nt('invite.email.subject'),
      nt('invite.email.body')
    ),
  ])
  .build();
