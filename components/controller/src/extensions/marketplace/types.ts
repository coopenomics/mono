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
 * давно истёкшим сроком годности в DRAFT-проект и шлёт нотификацию
 * председателю на ревью. Если false, крон только пушит напоминание;
 * председатель формирует корзину вручную.
 *
 * `post_expiry_grace_days` — сколько дней товар должен пролежать ПОСЛЕ
 * истечения срока годности, прежде чем попасть в кандидаты на списание.
 * Крон отбирает позиции с `expiry_date <= now - post_expiry_grace_days`.
 * Свежепросроченное ещё может быть забрано получателем — списываем только
 * окончательно испорченное (пролежавшее лишнее время).
 */
export interface IWriteoffConfig {
  auto_proposal_enabled: boolean;
  post_expiry_grace_days: number;
}

/**
 * Эпик 19: адресное хранение на складе КУ. Три независимых переключателя —
 * модели работы кооперативов расходятся, и включать их вместе неверно.
 *
 * `containers_enabled` — используются ли боксы (тара со своим QR). Основная
 * ожидаемая модель: наполнил бокс и поставил в угол, без координат.
 *
 * `cells_enabled` — используется ли координатная сетка ячеек «секция × ярус».
 * Нужна там, где склад работает на выдачу и место надо искать по адресу; на
 * маленьком складе только мешает.
 *
 * `posting_on_reception_required` — обязан ли председатель указать место
 * хранения прямо в окне закрывающей подписи акта приёмки. Выключено —
 * принятое падает в «без места», как было до Эпика 19.
 *
 * Все три по умолчанию выключены: кооперативы, установившие «Стол заказов»
 * раньше, поведения не меняют. Кооперативному кафе не нужно ничего из этого.
 */
export interface IWarehouseConfig {
  containers_enabled: boolean;
  cells_enabled: boolean;
  posting_on_reception_required: boolean;
}

// Конфигурация для расширения marketplace
export interface IConfig {
  // Story 1.9: статус принятия положения ЦПП Советом кооператива (системное
  // состояние, скрыто из формы установки).
  coopAcceptance: ICoopAcceptanceConfig;
  // Story 8.3 (Эпик 8): настройки крона списания скоропорта.
  writeoff: IWriteoffConfig;
  // Эпик 19: адресное хранение (боксы, координатные ячейки, обязательность
  // указания места при приёмке).
  warehouse: IWarehouseConfig;
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
    post_expiry_grace_days: 7,
  },
  warehouse: {
    containers_enabled: false,
    cells_enabled: false,
    posting_on_reception_required: false,
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
      post_expiry_grace_days: z
        .number()
        .int()
        .min(0)
        .default(7)
        .describe(
          describeField({
            label: 'Списывать спустя (после истечения срока)',
            note: 'Сколько дней товар должен пролежать после истечения срока годности, прежде чем попадёт в проект списания. Свежепросроченное ещё может быть забрано получателем — списываем только окончательно испорченное.',
            rules: ['val >= 0'],
            append: 'дн.',
          })
        ),
    })
    .default({ auto_proposal_enabled: true, post_expiry_grace_days: 7 })
    .describe(
      describeField({
        label: 'Списание скоропорта',
        note: 'Настройки автоматического списания товаров с истёкшим сроком годности.',
      })
    ),
  warehouse: z
    .object({
      containers_enabled: z
        .boolean()
        .default(false)
        .describe(
          describeField({
            label: 'Использовать боксы',
            note: 'Имущество складывается в боксы — тару со своим QR-кодом. Бокс можно поставить в ячейку, а можно оставить без адреса. Выключено — раздел боксов недоступен.',
          })
        ),
      cells_enabled: z
        .boolean()
        .default(false)
        .describe(
          describeField({
            label: 'Использовать координатные ячейки',
            note: 'Склад адресуется координатами «секция × ярус» и читается как таблица — место находится по адресу. Нужно там, где склад работает на выдачу. Выключено — понятий секции и яруса в интерфейсе нет.',
          })
        ),
      posting_on_reception_required: z
        .boolean()
        .default(false)
        .describe(
          describeField({
            label: 'Требовать указание места при приёмке',
            note: 'Председатель указывает место хранения прямо при закрывающей подписи акта приёмки и не может подписать, пока размещено не всё. Выключено — принятое попадает на склад без места, разложить можно позже.',
          })
        ),
    })
    .default({
      containers_enabled: false,
      cells_enabled: false,
      posting_on_reception_required: false,
    })
    .describe(
      describeField({
        label: 'Адресное хранение на складе',
        note: 'Боксы и координатные ячейки на складах кооперативных участков. Кооперативной закупке нужны, небольшому кооперативному кафе будут мешать.',
      })
    ),
});
