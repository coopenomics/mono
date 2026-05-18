import { z } from 'zod';

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
  enabled: boolean;
  lastSyncTimestamp: string;
  debug: boolean;
  // Story 1.9: статус принятия положения ЦПП Советом кооператива.
  coopAcceptance: ICoopAcceptanceConfig;
  // Story 8.3 (Эпик 8): настройки крона списания скоропорта.
  writeoff: IWriteoffConfig;
}

// Дефолтные параметры конфигурации
export const defaultConfig: IConfig = {
  enabled: true,
  lastSyncTimestamp: '',
  debug: false,
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

// Схема валидации конфигурации
export const Schema = z.object({
  enabled: z.boolean().default(true),
  lastSyncTimestamp: z.string().default(''),
  debug: z.boolean().default(false),
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
    }),
  writeoff: z
    .object({
      auto_proposal_enabled: z.boolean().default(false),
      expiry_grace_days: z.number().int().min(0).default(7),
    })
    .default({ auto_proposal_enabled: false, expiry_grace_days: 7 }),
});
