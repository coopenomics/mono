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
 * `auto_proposal_enabled` — если true, ежемесячный крон собирает позиции с
 * УЖЕ истёкшим сроком годности (`MarketplaceInventory.expiry_date <= now`) в
 * DRAFT-проект и шлёт нотификацию председателю на ревью. Если false, крон
 * только пушит напоминание; председатель формирует корзину вручную.
 *
 * Списываем по факту порчи (срок годности истёк), а не заранее: на списание
 * попадает только то, что уже непригодно.
 */
export interface IWriteoffConfig {
  auto_proposal_enabled: boolean;
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
    auto_proposal_enabled: true,
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
        .default(true)
        .describe(
          describeField({
            label: 'Автоматически формировать проект списания',
            note: 'Если включено, раз в месяц собирается проект списания товаров с истёкшим сроком годности и отправляется председателю на ревью. Если выключено — приходит только напоминание.',
          })
        ),
    })
    .default({ auto_proposal_enabled: true })
    .describe(
      describeField({
        label: 'Списание скоропорта',
        note: 'Настройки автоматического списания товаров с истёкшим сроком годности.',
      })
    ),
});
