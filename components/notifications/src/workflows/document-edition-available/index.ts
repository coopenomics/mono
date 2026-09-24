import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('documentEditionAvailable.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'vyshla-novaya-redaktsiya-dokumenta-kooperativa';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('documentEditionAvailable')
  .description(nt('documentEditionAvailable.description'))
  .payloadSchema(documentEditionAvailablePayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'document-edition-available-email',
      nt('documentEditionAvailable.email.subject'),
      nt('documentEditionAvailable.email.body')
    ),
    createInAppStep(
      'document-edition-available-notification',
      nt('documentEditionAvailable.inApp.subject'),
      nt('documentEditionAvailable.inApp.body')
    ),
    createPushStep(
      'document-edition-available-push',
      nt('documentEditionAvailable.push.subject'),
      nt('documentEditionAvailable.push.body')
    ),
  ])
  .build();
