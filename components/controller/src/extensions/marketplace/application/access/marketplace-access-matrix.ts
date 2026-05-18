import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';

/**
 * Story 1.8: централизованная access-matrix marketplace (CASL-совместимая).
 *
 * Структура: `Record<MarketplaceRole, Record<Resource, Action[]>>`.
 * `canAccess(roles, resource, action)` возвращает true, если в матрице
 * для хотя бы одной из `roles` есть `resource` → `action` (или его
 * квалифицированная форма).
 *
 * Нотации actions:
 *   - `create`, `update`, `delete`, `read`, `cancel` — базовые action.
 *   - `:own`        — только над объектом, владелец которого == текущий пайщик.
 *   - `:all`        — над всеми объектами в скоупе.
 *   - `:to-self`    — частный случай read: объекты, адресованные пайщику.
 *   - `:own-KU`     — только в рамках КУ, председатель которого == пайщик (Эпик 2).
 *   - `:first`      — первая подпись в multisig (Эпик 2/6).
 *
 * Ownership-проверка (`:own`/`:own-KU`/`:to-self`) сама matrix НЕ делает —
 * resolver обязан верифицировать `member_id == record.owner`/`record.recipient`
 * после прохождения guard'а. Guard отвечает за «эта роль вообще может
 * action над resource» (capability), а не за data-uniqueness ownership.
 *
 * Phase 2 migration: содержимое транслируется в CASL `defineAbility`,
 * `canAccess` подменяется на `ability.can(action, subject)` без изменения
 * вызывающего кода (guard читает абилити через тот же интерфейс).
 *
 * Resources покрытие: MVP Эпик 1–4. Эпики 5–10 (АПП, гарантийный возврат,
 * витрина, отчётность) добавят новые resources — расширение матрицы без
 * правок resolver-ов.
 */
export const marketplaceAccessMatrix: Record<MarketplaceRole, Record<string, string[]>> = {
  orderer: {
    Order: ['create', 'read:own', 'cancel:own'],
    Offer: ['read'],
    KU: ['read'],
    Vitrine: ['read'],
    // Story 6.3 / FR24: заказчик закрывает АПП-выдачу финальной подписью
    // на ПВЗ и видит свои заказы, готовые к получению.
    Issuance: ['sign:final', 'read:own'],
    // Story 7.1 / FR29: заказчик подаёт заявление на гарантийный возврат
    // имущества по своему Order'у в пределах гарантийного срока и видит
    // только свои заявления.
    ReturnClaim: ['create:own', 'read:own'],
  },
  offerer: {
    Offer: ['create:own', 'update:own', 'delete:own', 'read'],
    Order: ['read:to-self'],
    Shipment: ['create:own'],
    Receiving: ['sign:first'],
    KU: ['read'],
    Vitrine: ['read'],
  },
  operator: {
    Receiving: ['create', 'sign:closing'],
    // Story 6.1: оператор/председатель КУ открывает выдачу первой подписью
    // АПП-выдачи (`signiss1`) и видит ленту выдач на своём КУ.
    Issuance: ['create', 'sign:first', 'read:own-KU'],
    Inventory: ['label'],
    Warehouse: ['read:own-KU'],
    KU: ['read:own-KU'],
    Vitrine: ['read'],
    // Story 7.2 / 7.3 / FR30-FR32: председатель КУ доставки видит заявления
    // на возврат своего КУ, принимает удалённые и очные решения. Действия:
    //  - read:own-KU   — лента и detail заявлений;
    //  - decide:remote — одобрить визит / отказать удалённо (Story 7.2);
    //  - decide:on-site — принять / отказать на месте (Story 7.3 + 7.4).
    ReturnClaim: ['read:own-KU', 'decide:remote', 'decide:on-site'],
  },
  admin: {
    Offer: ['moderate', 'read'],
    Order: ['read:all'],
    KU: ['manage'],
    Whitelist: ['manage'],
    Vitrine: ['manage', 'read'],
    Warehouse: ['read:all'],
    Extension: ['configure'],
  },
  board_readonly: {
    Warehouse: ['read:all'],
    Order: ['read:all'],
    Offer: ['read:all'],
    Agenda: ['read'],
  },
  board: {
    Agenda: ['manage'],
    Writeoff: ['decide'],
    Decision: ['create', 'sign'],
  },
};

/**
 * Проверяет, что хотя бы одна из `roles` пайщика имеет в матрице запись
 * `resource` → `action`. Ownership-квалификаторы (`:own`/`:all`/...)
 * матчатся буквально — это значит resolver должен передать ровно тот
 * action, что записан в матрице (например, `'read:own'`, не `'read'`).
 * Для проверки «может ли роль вообще читать resource в любой форме» —
 * используйте `roleHasAnyAction(role, resource, baseAction)`.
 */
export function canAccess(
  roles: MarketplaceRole[],
  resource: string,
  action: string
): boolean {
  return roles.some((role) => {
    const resourceActions = marketplaceAccessMatrix[role]?.[resource];
    return resourceActions?.includes(action) ?? false;
  });
}

/**
 * Возвращает true, если хотя бы одна роль имеет ANY action на resource
 * с тем же базовым именем (до двоеточия). Полезно для предварительной
 * фильтрации UI (показать ли пункт меню «Заказы», если у пайщика есть
 * хоть какое-то `Order:read*`).
 */
export function roleHasAnyAction(
  roles: MarketplaceRole[],
  resource: string,
  baseAction: string
): boolean {
  return roles.some((role) => {
    const resourceActions = marketplaceAccessMatrix[role]?.[resource];
    if (!resourceActions) return false;
    return resourceActions.some((a) => a === baseAction || a.startsWith(`${baseAction}:`));
  });
}
