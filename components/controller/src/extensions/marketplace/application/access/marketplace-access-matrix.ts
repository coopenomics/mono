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
    // Эпик 16: заказчик управляет своей корзиной (накопитель перед оформлением).
    Cart: ['manage:own'],
    KU: ['read'],
    Vitrine: ['read'],
    // Story 6.3 / FR24: заказчик закрывает АПП-выдачу финальной подписью
    // на ПВЗ и видит свои заказы, готовые к получению.
    Issuance: ['sign:final', 'read:own'],
    // Story 7.1 / FR29: заказчик подаёт заявление на гарантийный возврат
    // имущества по своему Order'у в пределах гарантийного срока и видит
    // только свои заявления.
    ReturnClaim: ['create:own', 'read:own'],
    // requirement 76 (докладка): пайщик видит свои входящие предложения со
    // склада кооператива и решает их судьбу — принять или отказаться.
    StockProposal: ['read:own', 'resolve:own'],
    // requirement b6: единая ставка членского взноса видна заказчику —
    // каталог показывает цену с учётом взноса.
    Economy: ['read'],
  },
  offerer: {
    Offer: ['create:own', 'update:own', 'delete:own', 'read'],
    Order: ['read:to-self'],
    Shipment: ['create:own'],
    // Story 5.3/5.4: поставщик подписывает АПП первым (по приходу
    // имущества). `sign:first` оставлен для backward-compat, `sign:as-supplier`
    // — каноническая action из AC Story 5.4. `cancel:own` — отказ от
    // черновика приёмки до своей подписи (onsite-gate «Отменить»): on-chain
    // ещё ничего нет, партия возвращается оператору к повторной приёмке.
    Receiving: ['sign:first', 'sign:as-supplier', 'cancel:own'],
    KU: ['read'],
    Vitrine: ['read'],
    Economy: ['read'],
  },
  operator: {
    Receiving: ['create', 'sign:closing'],
    // Story 6.1: оператор/председатель КУ открывает выдачу первой подписью
    // АПП-выдачи (`signiss1`) и видит ленту выдач на своём КУ.
    Issuance: ['create', 'sign:first', 'read:own-KU'],
    // Поток IV шаг 1: оператор/председатель КУ видит ленту ожидаемых партий
    // поставки на своём участке, чтобы открыть приёмку по приходу.
    Shipment: ['read:own-KU'],
    // requirement (2026-08-03): реестр заказов, идущих на свой КУ — та же
    // сводка, что видит администратор по всему кооперативу, но отфильтрована
    // по своему участку; со ссылкой из «Экономики участка» (движения по
    // кошельку → конкретный заказ).
    Order: ['read:own-KU'],
    Inventory: ['label'],
    Warehouse: ['read:own-KU'],
    // Эпик 19: председатель КУ ведёт топологию склада своего участка —
    // заводит сетку ячеек, правит подписи, выводит пустые из оборота.
    StorageCell: ['manage:own-KU', 'read:own-KU'],
    // Эпик 19: председатель КУ ведёт реестр боксов своего участка —
    // заводит партии, печатает этикетки, ставит в ячейки, выводит пустые.
    Container: ['manage:own-KU', 'read:own-KU'],
    KU: ['read:own-KU'],
    Vitrine: ['read'],
    // Story 7.2 / 7.3 / FR30-FR32: председатель КУ доставки видит заявления
    // на возврат своего КУ, принимает удалённые и очные решения. Действия:
    //  - read:own-KU   — лента и detail заявлений;
    //  - decide:remote — одобрить визит / отказать удалённо (Story 7.2);
    //  - decide:on-site — принять / отказать на месте (Story 7.3 + 7.4).
    ReturnClaim: ['read:own-KU', 'decide:remote', 'decide:on-site'],
    // requirement 76: оператор управляет обезличенным остатком своего КУ —
    // публикует его в каталог (цена прибытия/уценка), снимает с публикации,
    // накидывает предложения докладки у стойки и отзывает их, отменяет
    // заказ из остатка до своей подписи на акте выдачи.
    Stock: ['read:own-KU', 'publish:own-KU'],
    StockProposal: ['create:own-KU', 'read:own-KU', 'cancel:own-KU'],
    // requirement b6 «Экономика КУ»: председатель настраивает отсечку и веса
    // распределения членских взносов своего КУ (configure — внутри сервис
    // дополнительно сверяет, что инициатор — именно trustee); председатель и
    // доверенные видят экономику своих КУ и распоряжаются персональными
    // средствами (перевод в «Стол заказов», материальная помощь).
    Economy: ['read', 'read:own-KU', 'configure:own-KU', 'use:own'],
    // Эпик 8: председатель КУ подтверждает фактическое списание со склада
    // своего участка по решению совета (подпись Служебной записки 1111 →
    // confirmwroff) и видит список таких ожидающих подтверждения групп.
    Writeoff: ['read:own-KU', 'confirm:own-KU'],
  },
  admin: {
    // read:all — реестр всех предложений кооператива любого статуса (наряду с
    // модерацией PENDING); read:all есть и у совета (board_readonly).
    Offer: ['moderate', 'read', 'read:all'],
    Order: ['read:all'],
    KU: ['manage'],
    // Реестр поставщиков: администратор видит реестр и добавляет поставщика
    // напрямую (путь 2). Одобрение/отклонение заявок (`approve`/`reject`) —
    // действие председателя, проверяется отдельно в резолвере по Chairman-роли.
    Supplier: ['manage'],
    Vitrine: ['manage', 'read'],
    // Доступные категории кооператива (Эпик 16). Маршрут стола
    // `market-admin/category-whitelist` требует `Whitelist:manage`, но этого
    // токена не выдавала ни одна роль — страница была недостижима вообще ни
    // для кого, хотя резолверы (available-category-admin.resolver.ts) живы и
    // защищены ролью председателя. Выдаём администратору ровно то, что уже
    // разрешает сервер.
    Whitelist: ['manage'],
    Warehouse: ['read:all'],
    // Эпик 19: администратор видит топологию складов всех участков.
    StorageCell: ['read:all'],
    // Эпик 19: сводный реестр боксов кооператива с объёмом и заполненностью.
    Container: ['read:all', 'read:own-KU'],
    Shipment: ['read:all'],
    Payment: ['read:all'],
    Extension: ['configure'],
    // Эпик 8: общий администратор формирует и редактирует DRAFT-проект
    // списания, подписывает Заявление 1106 и отправляет проект в совет.
    Writeoff: ['manage_draft', 'propose', 'read:all'],
    Stock: ['read:all', 'publish:all'],
    StockProposal: ['create:all', 'read:all', 'cancel:all'],
    // requirement b6: администратор устанавливает единую ставку членского
    // взноса кооператива и видит экономику любого КУ и все заявки на помощь.
    Economy: ['read', 'read:all', 'read:own-KU', 'set-fee', 'use:own'],
  },
  board_readonly: {
    Warehouse: ['read:all'],
    Order: ['read:all'],
    Offer: ['read:all'],
    Agenda: ['read'],
    Writeoff: ['read:all'],
    // Совет ведёт read-only надзор за расчётами кооператива с поставщиками:
    // подтверждение/отказ выплат делает кассир, совету нужен только обзор.
    Payment: ['read:all'],
  },
  board: {
    Agenda: ['manage'],
    // Эпик 8: совет — авторизация Протокола 1105 идёт через стандартный
    // sov.decision flow (votefor / authorize), `decide` остаётся как
    // capability-маркер для UI «может ли роль видеть и принимать решение».
    Writeoff: ['decide', 'read:all'],
    Decision: ['create', 'sign'],
    Payment: ['read:all'],
  },
};

/**
 * Проверяет, что хотя бы одна из `roles` пайщика имеет в матрице запись
 * `resource` → `action`. Ownership-квалификаторы матчатся буквально, с одним
 * исключением — иерархией охвата: право `<base>:all` (над всеми объектами в
 * скоупе) удовлетворяет требование `<base>:own` / `<base>:own-KU` /
 * `<base>:to-self` того же базового action, потому что «все объекты» — это
 * надмножество «своих / своего КУ / адресованных себе». Обратное неверно:
 * `<base>:own*` НЕ удовлетворяет требование `<base>:all`.
 *
 * Зачем: резолверы декларируют узкий action (например, `Warehouse:read:own-KU`
 * для оператора), а роль с широким правом (`admin` → `Warehouse:read:all`)
 * должна проходить тот же гейт — иначе председатель кооператива получает
 * Forbidden на сводном складе, имея более широкое право.
 *
 * Ownership-фильтрацию данных (вернуть ровно свои/свой-КУ записи) матрица НЕ
 * делает — это ответственность resolver'а. Для проверки «может ли роль вообще
 * читать resource в любой форме» используйте `roleHasAnyAction`.
 */
const SUBSET_QUALIFIERS = new Set(['own', 'own-KU', 'to-self']);

export function canAccess(
  roles: MarketplaceRole[],
  resource: string,
  action: string
): boolean {
  return roles.some((role) => {
    const resourceActions = marketplaceAccessMatrix[role]?.[resource];
    if (!resourceActions) return false;
    if (resourceActions.includes(action)) return true;

    const colon = action.indexOf(':');
    if (colon > 0) {
      const base = action.slice(0, colon);
      const qualifier = action.slice(colon + 1);
      if (SUBSET_QUALIFIERS.has(qualifier)) {
        return resourceActions.includes(`${base}:all`);
      }
    }
    return false;
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
