
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для meet-started воркфлоу
export const meetStartedPayloadSchema = z.object({
  coopShortName: z.string(),
  meetId: z.number(),
  meetEndDate: z.string(),
  meetEndTime: z.string(),
  timezone: z.string(),
  meetUrl: z.string(),
  details: z.string().optional(),
});

export type IPayload = z.infer<typeof meetStartedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('meetStarted.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'sobranie-nachalos';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('meetStarted')
  .description(nt('meetStarted.description'))
  .payloadSchema(meetStartedPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'meet-started-email',
      nt('meetStarted.email.subject'),
      nt('meetStarted.email.body')
    ),
    createInAppStep(
      'meet-started-notification',
      nt('meetStarted.inApp.subject'),
      nt('meetStarted.inApp.body')
    ),
    createPushStep(
      'meet-started-push',
      nt('meetStarted.push.subject'),
      nt('meetStarted.push.body')
    ),
  ])
  .build();

