import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для branch-meeting-reminder воркфлоу
export const branchMeetingReminderPayloadSchema = z.object({
  coopShortName: z.string(),
  meetPlace: z.string(),
  meetAtTime: z.string(),
  meetingUrl: z.string(),
});

export type IPayload = z.infer<typeof branchMeetingReminderPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('branchMeetingReminder.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'napominanie-o-sobranii-uchastka';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('branchMeetingReminder')
  .description(nt('branchMeetingReminder.description'))
  .payloadSchema(branchMeetingReminderPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-meeting-reminder-email',
      nt('branchMeetingReminder.email.subject'),
      nt('branchMeetingReminder.email.body')
    ),
    createInAppStep(
      'branch-meeting-reminder-notification',
      nt('branchMeetingReminder.inApp.subject'),
      nt('branchMeetingReminder.inApp.body')
    ),
    createPushStep(
      'branch-meeting-reminder-push',
      nt('branchMeetingReminder.push.subject'),
      nt('branchMeetingReminder.push.body')
    ),
  ])
  .build();
