import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Заверение кооператива в цепочке доверия подходит к концу срока. Пока оно
// действует, удостоверения пайщиков проходят проверку; как только истечёт —
// проверяющий увидит, что принадлежность кооператива к цепочке не подтверждена.
export const endorsementExpiringPayloadSchema = z.object({
  chairmanName: z.string(),
  short_abbr: z.string(),
  name: z.string(),
  daysLeft: z.string(),
  expiresAt: z.string(),
});

export type IPayload = z.infer<typeof endorsementExpiringPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('endorsementExpiring.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'zaverenie-kooperativa-v-tsepochke-doveriya-istekaet';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('endorsementExpiring')
  .description(nt('endorsementExpiring.description'))
  .payloadSchema(endorsementExpiringPayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'endorsement-expiring-email',
      nt('endorsementExpiring.email.subject'),
      nt('endorsementExpiring.email.body')
    ),
    createInAppStep(
      'endorsement-expiring-notification',
      nt('endorsementExpiring.inApp.subject'),
      nt('endorsementExpiring.inApp.body')
    ),
    createPushStep(
      'endorsement-expiring-push',
      nt('endorsementExpiring.push.subject'),
      nt('endorsementExpiring.push.body')
    ),
  ])
  .build();
