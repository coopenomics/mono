import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Схема для branch-voting-started воркфлоу
export const branchVotingStartedPayloadSchema = z.object({
  coopShortName: z.string(),
  meetPlace: z.string(),
  closeAtTime: z.string(),
  meetingUrl: z.string(),
});

export type IPayload = z.infer<typeof branchVotingStartedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Голосование собрания участка началось';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление участникам собрания пайщиков кооперативного участка о начале голосования')
  .payloadSchema(branchVotingStartedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-voting-started-email',
      'Голосование собрания пайщиков участка в {{payload.coopShortName}} началось',
      'Уважаемый пайщик!<br><br>На собрании пайщиков кооперативного участка ({{payload.meetPlace}}) открыто голосование по вопросам повестки дня.<br>Голосование завершится в {{payload.closeAtTime}}.<br><br>Для подачи бюллетеня перейдите по ссылке:<br><a href="{{payload.meetingUrl}}">{{payload.meetingUrl}}</a><br><br>С уважением, {{payload.coopShortName}}.'
    ),
    createInAppStep(
      'branch-voting-started-notification',
      'Голосование собрания участка началось',
      'Подайте бюллетень до {{payload.closeAtTime}}'
    ),
    createPushStep(
      'branch-voting-started-push',
      'Голосование собрания участка началось',
      'Подайте бюллетень до {{payload.closeAtTime}}'
    ),
  ])
  .build();
