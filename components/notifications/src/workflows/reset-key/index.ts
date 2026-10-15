import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

// Схема для reset-key воркфлоу
export const resetKeyPayloadSchema = z.object({
  resetUrl: z.string(),
});

export type IPayload = z.infer<typeof resetKeyPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('resetKey.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'vosstanovlenie-dostupa';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('resetKey')
  .description(nt('resetKey.description'))
  .payloadSchema(resetKeyPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'reset-key-email',
      nt('resetKey.email.subject'),
      nt('resetKey.email.body')
    ),
  ])
  .build();
