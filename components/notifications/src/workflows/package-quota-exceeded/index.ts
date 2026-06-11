import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Epic 13 v5.1 — кооператив упёрся в месячную квоту докупки пакетов
// документооборота: AXON исчерпан, а провайдер отказал hub-cron'у в выписке
// очередного package-invoice (quota_exceeded). Чтобы продолжить работу в этом
// месяце, кооперативу нужно поднять квоту (редактируемый параметр тарифа).
export const packageQuotaExceededPayloadSchema = z.object({
  coopName: z.string(), // отображаемое имя кооператива-пайщика
  quotaRub: z.string(), // действующая месячная квота, ₽
  spentRub: z.string(), // уже потрачено на пакеты в этом месяце, ₽
  packagePriceRub: z.string(), // цена одного пакета, ₽
  settingsUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof packageQuotaExceededPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Квота пакетов документооборота исчерпана';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Месячная квота докупки пакетов документооборота исчерпана; для продолжения работы нужно поднять квоту')
  .payloadSchema(packageQuotaExceededPayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep(
      'package-quota-exceeded-email',
      'Квота пакетов документооборота исчерпана',
      'Кооператив «{{payload.coopName}}», месячная квота докупки пакетов документооборота исчерпана: потрачено {{payload.spentRub}} ₽ при квоте {{payload.quotaRub}} ₽.<br><br>Ресурсы документооборота (AXON) закончились, и автоматическая докупка пакета за {{payload.packagePriceRub}} ₽ заблокирована до конца месяца.<br><br>Чтобы продолжить работу, поднимите месячную квоту в настройках подписки: {{payload.settingsUrl}}'
    ),
    createInAppStep(
      'package-quota-exceeded-in-app',
      'Квота пакетов исчерпана',
      'Докупка пакетов документооборота заблокирована: потрачено {{payload.spentRub}} ₽ из {{payload.quotaRub}} ₽ за месяц. Поднимите квоту, чтобы продолжить работу.'
    ),
    createPushStep(
      'package-quota-exceeded-push',
      'Квота пакетов исчерпана',
      'Докупка заблокирована ({{payload.spentRub}} ₽ из {{payload.quotaRub}} ₽). Поднимите квоту'
    ),
  ])
  .build();
