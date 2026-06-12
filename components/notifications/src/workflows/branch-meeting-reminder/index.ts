import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Схема для branch-meeting-reminder воркфлоу
export const branchMeetingReminderPayloadSchema = z.object({
  coopShortName: z.string(),
  meetPlace: z.string(),
  meetAtTime: z.string(),
  meetingUrl: z.string(),
});

export type IPayload = z.infer<typeof branchMeetingReminderPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Напоминание о собрании участка';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Напоминание участникам собрания пайщиков кооперативного участка за час до начала')
  .payloadSchema(branchMeetingReminderPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-meeting-reminder-email',
      'Через час собрание пайщиков участка в {{payload.coopShortName}}',
      'Уважаемый пайщик!<br><br>Напоминаем, что через час, в {{payload.meetAtTime}}, состоится собрание пайщиков кооперативного участка.<br>Место проведения: {{payload.meetPlace}}.<br><br>Страница собрания:<br><a href="{{payload.meetingUrl}}">{{payload.meetingUrl}}</a><br><br>С уважением, {{payload.coopShortName}}.'
    ),
    createInAppStep(
      'branch-meeting-reminder-notification',
      'Через час собрание участка',
      'Собрание начнётся в {{payload.meetAtTime}} ({{payload.meetPlace}})'
    ),
    createPushStep(
      'branch-meeting-reminder-push',
      'Через час собрание участка',
      'Собрание начнётся в {{payload.meetAtTime}}'
    ),
  ])
  .build();
