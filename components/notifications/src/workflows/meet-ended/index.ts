
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для meet-ended воркфлоу
export const meetEndedPayloadSchema = z.object({
  coopShortName: z.string(),
  meetId: z.number(),
  meetUrl: z.string(),
  endType: z.enum(['EXPIRED_NO_QUORUM', 'VOTING_COMPLETED', 'CLOSED']),
  endTitle: z.string(),
  endMessage: z.string(),
});

export type IPayload = z.infer<typeof meetEndedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('meetEnded.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sobranie-zaversheno';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('meetEnded')
  .description(nt('meetEnded.description'))
  .payloadSchema(meetEndedPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'meet-ended-email',
      nt('meetEnded.email.subject'),
      nt('meetEnded.email.body')
    ),
    createInAppStep(
      'meet-ended-notification',
      nt('meetEnded.inApp.subject'),
      nt('meetEnded.inApp.body')
    ),
    createPushStep(
      'meet-ended-push',
      nt('meetEnded.push.subject'),
      nt('meetEnded.push.body')
    ),
  ])
  .build();

