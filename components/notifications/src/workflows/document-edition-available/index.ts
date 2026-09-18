import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

/**
 * Оператор платформы выпустил новую редакцию документа, которым пользуется
 * кооператив. Пайщикам она не предъявляется, пока совет её не утвердит, —
 * председателю нужно вынести редакцию на совет.
 */
export const documentEditionAvailablePayloadSchema = z.object({
  userName: z.string(),
  documentTitle: z.string(),
  version: z.string(),
  coopname: z.string(),
  short_abbr: z.string(),
  name: z.string(),
  templatesUrl: z.string(),
});

export type IPayload = z.infer<typeof documentEditionAvailablePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Вышла новая редакция документа кооператива';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление председателю: оператор выпустил новую редакцию документа, её нужно вынести на утверждение совета')
  .payloadSchema(documentEditionAvailablePayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'document-edition-available-email',
      'Новая редакция документа «{{payload.documentTitle}}» ждёт утверждения совета {{payload.short_abbr}} {{payload.name}}',
      'Уважаемый {{payload.userName}}!<br><br>Оператор платформы выпустил редакцию № {{payload.version}} документа <strong>«{{payload.documentTitle}}»</strong>.<br><br>Пайщикам {{payload.short_abbr}} {{payload.name}} она предъявляется только после утверждения советом. Вынесите редакцию на совет во вкладке «Шаблоны документов»: <a href="{{payload.templatesUrl}}">{{payload.templatesUrl}}</a>'
    ),
    createInAppStep(
      'document-edition-available-notification',
      'Новая редакция документа',
      'Редакция № {{payload.version}} документа «{{payload.documentTitle}}» ждёт утверждения совета'
    ),
    createPushStep(
      'document-edition-available-push',
      'Новая редакция документа',
      '«{{payload.documentTitle}}», редакция № {{payload.version}} — требуется решение совета'
    ),
  ])
  .build();
