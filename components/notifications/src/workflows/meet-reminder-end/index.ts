
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для meet-reminder-end воркфлоу
export const meetReminderEndPayloadSchema = z.object({
  coopShortName: z.string(),
  meetId: z.number(),
  meetEndDate: z.string(),
  meetEndTime: z.string(),
  timeDescription: z.string(),
  timezone: z.string(),
  meetUrl: z.string(),
});

export type IPayload = z.infer<typeof meetReminderEndPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('meetReminderEnd.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'napominanie-o-zavershenii-sobraniya';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('meetReminderEnd')
  .description(nt('meetReminderEnd.description'))
  .payloadSchema(meetReminderEndPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'meet-reminder-end-email',
      nt('meetReminderEnd.email.subject'),
      nt('meetReminderEnd.email.body')
    ),
    createInAppStep(
      'meet-reminder-end-notification',
      nt('meetReminderEnd.inApp.subject'),
      nt('meetReminderEnd.inApp.body')
    ),
    createPushStep(
      'meet-reminder-end-push',
      nt('meetReminderEnd.push.subject'),
      nt('meetReminderEnd.push.body')
    ),
  ])
  .build();

