import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';

/**
 * Периодическое напоминание председателю: в кооперативе есть документы, чьи
 * редакции ждут утверждения совета. Пока их не утвердят, кооператив расходится
 * с сетью юридически.
 */
export const documentEditionReminderPayloadSchema = z.object({
  userName: z.string(),
  count: z.string(),
  documentTitles: z.string(),
  coopname: z.string(),
  short_abbr: z.string(),
  name: z.string(),
  templatesUrl: z.string(),
});

export type IPayload = z.infer<typeof documentEditionReminderPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('documentEditionReminder.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'redaktsii-dokumentov-zhdut-utverzhdeniya-soveta';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('documentEditionReminder')
  .description(nt('documentEditionReminder.description'))
  .payloadSchema(documentEditionReminderPayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'document-edition-reminder-email',
      nt('documentEditionReminder.email.subject'),
      nt('documentEditionReminder.email.body')
    ),
    createInAppStep(
      'document-edition-reminder-notification',
      nt('documentEditionReminder.inApp.subject'),
      nt('documentEditionReminder.inApp.body')
    ),
  ])
  .build();
