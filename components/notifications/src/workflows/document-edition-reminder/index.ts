import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { slugify } from '../../utils';

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

export const name = 'Редакции документов ждут утверждения совета';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Напоминание председателю о документах, редакции которых ещё не утверждены советом')
  .payloadSchema(documentEditionReminderPayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'document-edition-reminder-email',
      'Документы {{payload.short_abbr}} {{payload.name}} ждут утверждения совета: {{payload.count}}',
      'Уважаемый {{payload.userName}}!<br><br>В кооперативе {{payload.short_abbr}} {{payload.name}} редакции документов ждут решения совета: <strong>{{payload.documentTitles}}</strong>.<br><br>Пока решения нет, пайщикам предъявляются прежние редакции. Вынести документы на совет: <a href="{{payload.templatesUrl}}">{{payload.templatesUrl}}</a>'
    ),
    createInAppStep(
      'document-edition-reminder-notification',
      'Документы ждут утверждения совета',
      'Редакции документов ждут решения совета: {{payload.documentTitles}}'
    ),
  ])
  .build();
