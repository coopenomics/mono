import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { z } from 'zod';
import { slugify } from '../../utils';

// Схема payload для письма-подтверждения выхода из кооператива
export const membershipExitConfirmationPayloadSchema = z.object({
  confirmationUrl: z.string(),
});

export type IPayload = z.infer<typeof membershipExitConfirmationPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Подтверждение выхода из кооператива';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Подтверждение по email заявления о добровольном выходе пайщика из кооператива')
  .payloadSchema(membershipExitConfirmationPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'membership-exit-confirmation-email',
      'Подтверждение выхода из кооператива',
      'Здравствуйте!<br><br>' +
      'Вы подали заявление о добровольном выходе из кооператива. Это действие необратимо: ' +
      'после подтверждения запускается процедура выхода и возврата паевого взноса, а ваш аккаунт блокируется.<br><br>' +
      'Если вы действительно хотите выйти из кооператива, перейдите по ссылке для подтверждения: ' +
      '<a href="{{payload.confirmationUrl}}">{{payload.confirmationUrl}}</a><br><br>' +
      'Если вы не подавали такое заявление — просто проигнорируйте это письмо, ничего не произойдёт.'
    ),
  ])
  .build();
