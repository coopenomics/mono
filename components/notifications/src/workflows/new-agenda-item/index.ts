
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Схема для new-agenda-item воркфлоу
export const newAgendaItemPayloadSchema = z.object({
  coopname: z.string(),
  coopShortName: z.string(),
  itemTitle: z.string(),
  itemDescription: z.string(),
  authorName: z.string(),
  decision_id: z.string(),
  agendaUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof newAgendaItemPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Новый вопрос на повестке совета';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление о новом вопросе на повестке дня заседания совета для всех членов совета')
  .payloadSchema(newAgendaItemPayloadSchema)
  .tags(['member']) // Доступно только для членов совета
  .addSteps([
    createEmailStep(
      'new-agenda-item-email',
      'Новый вопрос на повестке совета {{payload.coopShortName}}',
      'Уважаемый член совета!<br><br>Добавлен новый вопрос на повестку заседания совета:<br><br><strong>{{payload.itemTitle}}</strong><br><br>{{payload.itemDescription}}<br><br>Заявитель: {{payload.authorName}}<br><br>Ссылка для рассмотрения: {{payload.agendaUrl}}<br><br>'
    ),
    createInAppStep(
      'new-agenda-item-notification',
      'Новый вопрос на повестке совета',
      '{{payload.itemTitle}}\nОт: {{payload.authorName}}'
    ),
    createPushStep(
      'new-agenda-item-push',
      'Новый вопрос на повестке',
      '{{payload.itemTitle}} от {{payload.authorName}}'
    ),
  ])
  .build(); 