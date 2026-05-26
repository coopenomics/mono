import { z } from 'zod';
import type { DeserializedDescriptionOfExtension } from '~/types/shared';

// Сериализация человекочитаемого описания поля для формы установки расширения
// (тот же механизм, что в capital-extension.module.ts).
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

/**
 * Story 1.9: L1-онбординг кооператива — решение совета о принятии положения ЦПП.
 *
 * `accepted` — флаг готовности расширения; `marketplaceCppStatus` отдаёт
 * `'active'` если true, `'not_accepted'` если false.
 * `document_registry_id` — id рендеренного instance положения ЦПП в
 * платформенном registry (или 0 если рендеринг ещё не выполнен; в Эпике 8
 * будет интегрировано с document factory).
 * `accepted_by_board_decision_id` — id решения Совета (FR40, Эпик 8); в MVP
 * пустая строка либо stub-значение председателя.
 *
 * Это внутреннее системное состояние (ставится решением совета), а не
 * настройка установки — в форме установки расширения скрыто (`visible: false`).
 */
export interface ICoopAcceptanceConfig {
  accepted: boolean;
  document_registry_id: number;
  accepted_at: string; // ISO-8601, пустая строка = «не принято».
  accepted_by_board_decision_id: string;
}

/**
 * Story 8.3 (Эпик 8): настройки авто-проекта списания скоропорта.
 *
 * `auto_proposal_enabled` — если true, ежемесячный крон собирает позиции
 * `MarketplaceInventory.expiry_date <= now + expiry_grace_days` в DRAFT-
 * проект и шлёт нотификацию председателю на ревью. Если false, крон
 * только пушит напоминание; председатель формирует корзину вручную.
 *
 * `expiry_grace_days` — окно опережения: за сколько дней до фактического
 * `expiry_date` позиция должна попадать в кандидаты на списание (например,
 * 7 — отбирать позиции, у которых до истечения срока меньше недели).
 */
export interface IWriteoffConfig {
  auto_proposal_enabled: boolean;
  expiry_grace_days: number;
}

// Конфигурация для расширения marketplace
export interface IConfig {
  // Story 1.9: статус принятия положения ЦПП Советом кооператива (системное
  // состояние, скрыто из формы установки).
  coopAcceptance: ICoopAcceptanceConfig;
  // Story 8.3 (Эпик 8): настройки крона списания скоропорта.
  writeoff: IWriteoffConfig;
}

// Дефолтные параметры конфигурации
export const defaultConfig: IConfig = {
  coopAcceptance: {
    accepted: false,
    document_registry_id: 0,
    accepted_at: '',
    accepted_by_board_decision_id: '',
  },
  writeoff: {
    auto_proposal_enabled: false,
    expiry_grace_days: 7,
  },
};

// Схема валидации конфигурации. Описания полей (label/note) — на русском, для
// формы установки расширения; системное состояние ЦПП скрыто (`visible: false`).
export const Schema = z.object({
  coopAcceptance: z
    .object({
      accepted: z.boolean().default(false),
      document_registry_id: z.number().default(0),
      accepted_at: z.string().default(''),
      accepted_by_board_decision_id: z.string().default(''),
    })
    .default({
      accepted: false,
      document_registry_id: 0,
      accepted_at: '',
      accepted_by_board_decision_id: '',
    })
    .describe(
      describeField({
        label: 'Принятие положения ЦПП',
        note: 'Системное состояние: заполняется решением совета при подключении ЦПП «Стол заказов».',
        visible: false,
      })
    ),
  writeoff: z
    .object({
      auto_proposal_enabled: z
        .boolean()
        .default(false)
        .describe(
          describeField({
            label: 'Автоматически формировать проект списания скоропорта',
            note: 'Если включено, по расписанию собирается проект списания товаров с истекающим сроком годности и отправляется председателю на ревью. Если выключено — приходит только напоминание.',
          })
        ),
      expiry_grace_days: z
        .number()
        .int()
        .min(0)
        .default(7)
        .describe(
          describeField({
            label: 'Запас по сроку годности',
            note: 'За сколько дней до истечения срока годности товар попадает в кандидаты на списание.',
            rules: ['val >= 0'],
            append: 'дн.',
          })
        ),
    })
    .default({ auto_proposal_enabled: false, expiry_grace_days: 7 })
    .describe(
      describeField({
        label: 'Списание скоропорта',
        note: 'Настройки автоматического списания товаров с истекающим сроком годности.',
      })
    ),
});
