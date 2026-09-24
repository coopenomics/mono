
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('newAgendaItem.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'noviy-vopros-na-povestke-soveta';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('newAgendaItem')
  .description(nt('newAgendaItem.description'))
  .payloadSchema(newAgendaItemPayloadSchema)
  .tags(['member']) // Доступно только для членов совета
  .addSteps([
    createEmailStep(
      'new-agenda-item-email',
      nt('newAgendaItem.email.subject'),
      nt('newAgendaItem.email.body')
    ),
    createInAppStep(
      'new-agenda-item-notification',
      nt('newAgendaItem.inApp.subject'),
      nt('newAgendaItem.inApp.body')
    ),
    createPushStep(
      'new-agenda-item-push',
      nt('newAgendaItem.push.subject'),
      nt('newAgendaItem.push.body')
    ),
  ])
  .build(); 