import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

// Схема для incoming-transfer воркфлоу
export const incomingTransferPayloadSchema = z.object({
  quantity: z.string(),
});

export type IPayload = z.infer<typeof incomingTransferPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('incomingTransfer.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'vkhodyaschiy-perevod';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('incomingTransfer')
  .description(nt('incomingTransfer.description'))
  .payloadSchema(incomingTransferPayloadSchema)
  .tags(['user']) // Доступно для всех ролей
  .addSteps([
    createEmailStep(
      'incoming-transfer-email',
      nt('incomingTransfer.email.subject'),
      nt('incomingTransfer.email.body')
    ),
    createInAppStep(
      'incoming-transfer-notification',
      nt('incomingTransfer.inApp.subject'),
      nt('incomingTransfer.inApp.body')
    ),
    createPushStep(
      'incoming-transfer-push',
      nt('incomingTransfer.push.subject'),
      nt('incomingTransfer.push.body')
    ),
  ])
  .build(); 