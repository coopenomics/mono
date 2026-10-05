import { rightConditions, rightMatches, rightsByRole, rightsHeld, type RightScope, type RightsGroup, type RightsTable } from '@coopenomics/extension-kit';
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
export type MarketplaceScope = RightScope;

/**
 * Условие строки таблицы — состояние кооператива или пайщика, при котором
 * право действует:
 *  - `coop-accepted`      — совет принял программу и положение Стола заказов;
 *  - `orderer-onboarded`  — пайщик подписал оферту программы и выбрал пункт выдачи;
 *  - `containers-enabled` — кооператив включил боксы в настройках склада;
 *  - `cells-enabled`      — кооператив включил ячейки хранения.
 */
export type MarketplaceCondition = 'coop-accepted' | 'orderer-onboarded' | 'containers-enabled' | 'cells-enabled';

export type MarketplaceRightsGroup = RightsGroup<MarketplaceCondition>;

const COOP: MarketplaceCondition[] = ['coop-accepted'];

/**
 * Таблица прав Стола заказов (C28-87): роль → условия → право.
 *
 * Одна таблица отвечает и серверу, и рабочему столу: гард операции и набор
 * прав для страниц собираются из неё (`MarketplaceRightsService`). До
 * 04.10.2026 условия знал только провайдер прав стола, и прямой запрос к
 * серверу проходил там, где стол прятал страницу.
 */
export const marketplaceRightsTable: RightsTable<MarketplaceRole, MarketplaceCondition> = {
  orderer: [
    {
      // Читается и до принятия программы советом: по этим правам стол
      // показывает, что подключать.
      when: [],
      rights: {
        Extension: ['read'],
        Membership: ['read:own'],
      },
    },
    {
      // Подключение пайщика: оферта, пункт выдачи, заявка поставщика.
      when: COOP,
      rights: {
        Onboarding: ['read:own', 'sign:own'],
        DeliveryPoint: ['choose:own'],
        KU: ['read'],
        Supplier: ['read:own', 'request:own'],
      },
    },
    {
      when: ['coop-accepted', 'orderer-onboarded'],
      rights: {
        Order: ['create', 'read:own', 'cancel:own'],
        Offer: ['read'],
        // Эпик 16: заказчик управляет своей корзиной (накопитель перед оформлением).
        Cart: ['manage:own'],
        Vitrine: ['read'],
        // Паевая модель (компонент 68): заказчик подписывает заявление о возврате
        // паевого взноса имуществом и первую подпись акта, видит ход своей выдачи.
        Issuance: ['sign:statement', 'sign:act', 'read:own'],
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
        MemberWallet: ['read:own'],
      },
    },
  ],
  offerer: [
    {
      when: COOP,
      rights: {
        Offer: ['create:own', 'update:own', 'delete:own', 'read'],
        Order: ['read:to-self'],
        Shipment: ['create:own'],
        // Поставщик подписывает акт приёмки первым (по приходу имущества).
        // `cancel:own` — отказ от черновика приёмки до своей подписи: в цепи
        // ещё ничего нет, партия возвращается оператору к повторной приёмке.
        Receiving: ['sign:first', 'cancel:own'],
        KU: ['read'],
        Vitrine: ['read'],
        Economy: ['read'],
        // 99D-13: гарантийные претензии, выставленные этому поставщику
        SupplierClaim: ['read:to-self', 'respond:to-self'],
        // Выплаты кооператива этому поставщику.
        Payment: ['read:to-self'],
      },
    },
  ],
  operator: [
    {
      when: COOP,
      rights: {
        Receiving: ['create', 'sign:closing', 'cancel:own-KU'],
        // Паевая модель (компонент 68): оператор участка отмечает готовность,
        // фиксирует факт у стойки (create), закрывает выдачу второй подписью акта
        // (close), отменяет начатую выдачу (cancel) и видит ленту своего участка.
        Issuance: ['create', 'close', 'cancel', 'read:own-KU'],
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
        Vitrine: ['read'],
        // Имущество на складе участка открывается карточкой предложения, по
        // которому оно пришло: оператору нужно видеть поставщика, упаковку и
        // условия, иначе по одному наименованию непонятно, что он выдаёт
        // (решение владельца 14.09.2026). Только чтение — модерация и правка
        // остаются у председателя кооператива.
        Offer: ['read'],
        // Story 7.2 / 7.3 / FR30-FR32: председатель КУ доставки видит заявления
        // на возврат своего КУ, принимает удалённые и очные решения. Действия:
        //  - read:own-KU   — лента и detail заявлений;
        //  - decide:remote — одобрить визит / отказать удалённо (Story 7.2);
        //  - decide:on-site — принять / отказать на месте (Story 7.3 + 7.4).
        ReturnClaim: ['read:own-KU', 'decide:remote', 'decide:on-site', 'hand-back'],
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
    },
    {
      when: ['coop-accepted', 'cells-enabled'],
      rights: {
        // Эпик 19: председатель КУ ведёт топологию склада своего участка —
        // заводит сетку ячеек, правит подписи, выводит пустые из оборота.
        StorageCell: ['manage:own-KU', 'read:own-KU'],
      },
    },
    {
      when: ['coop-accepted', 'containers-enabled'],
      rights: {
        // Эпик 19: председатель КУ ведёт реестр боксов своего участка —
        // заводит партии, печатает этикетки, ставит в ячейки, выводит пустые.
        Container: ['manage:own-KU', 'read:own-KU'],
      },
    },
  ],
  admin: [
    {
      // Подключение кооператива ведёт председатель — до решения совета.
      when: [],
      rights: {
        Extension: ['configure'],
      },
    },
    {
      when: COOP,
      rights: {
        // read:all — реестр всех предложений кооператива любого статуса (наряду с
        // модерацией PENDING); read:all есть и у совета (board_readonly).
        Offer: ['moderate', 'read', 'read:all'],
        // Задача 99D-14: сверка инвариантов учёта Стола заказов (счета 10/76/91,
        // кошельки резерва и выплат) — по запросу председателя.
        Ledger: ['audit'],
        Order: ['read:all'],
        KU: ['manage'],
        // Реестр поставщиков: администратор видит реестр и добавляет поставщика
        // напрямую (путь 2). Одобрение/отклонение заявок (`approve`/`reject`) —
        // действие председателя, проверяется отдельно в резолвере по Chairman-роли.
        Supplier: ['manage'],
        Vitrine: ['read'],
        // Доступные категории кооператива (Эпик 16). Маршрут стола
        // `market-admin/category-whitelist` требует `Whitelist:manage`, но этого
        // токена не выдавала ни одна роль — страница была недостижима вообще ни
        // для кого, хотя резолверы (available-category-admin.resolver.ts) живы и
        // защищены ролью председателя. Выдаём администратору ровно то, что уже
        // разрешает сервер.
        Whitelist: ['manage'],
        Warehouse: ['read:all'],
        Shipment: ['read:all'],
        Payment: ['read:all'],
        SupplierClaim: ['read:all'],
        // Эпик 8: общий администратор формирует и редактирует DRAFT-проект
        // списания, подписывает Заявление 1106 и отправляет проект в совет.
        Writeoff: ['manage_draft', 'propose', 'read:all'],
        Stock: ['read:all', 'publish:all'],
        StockProposal: ['create:all', 'read:all', 'cancel:all'],
        // requirement b6: администратор устанавливает единую ставку членского
        // взноса кооператива и видит экономику любого КУ и все заявки на помощь.
        Economy: ['read', 'read:all', 'read:own-KU', 'set-fee', 'use:own'],
      },
    },
    {
      when: ['coop-accepted', 'cells-enabled'],
      rights: {
        // Эпик 19: администратор видит топологию складов всех участков.
        StorageCell: ['read:all'],
      },
    },
    {
      when: ['coop-accepted', 'containers-enabled'],
      rights: {
        // Эпик 19: сводный реестр боксов кооператива с объёмом и заполненностью.
        // `manage:types` — справочник типов тары: габариты и объём общие на весь
        // кооператив (решение владельца 14.09.2026), поэтому типы заводит
        // председатель, а участки только выбирают из них при заведении боксов.
        Container: ['read:all', 'read:own-KU', 'manage:types'],
      },
    },
  ],
  board_readonly: [
    {
      when: COOP,
      rights: {
        Warehouse: ['read:all'],
        Order: ['read:all'],
        // Совет читает реестр всех предложений; карточку предложения, витрину и
        // ставку взноса он открывает по этим же данным — без подключения
        // заказчиком, как оператор участка.
        Offer: ['read', 'read:all'],
        Vitrine: ['read'],
        Economy: ['read'],
        Writeoff: ['read:all'],
        // Совет ведёт read-only надзор за расчётами кооператива с поставщиками:
        // подтверждение/отказ выплат делает кассир, совету нужен только обзор.
        Payment: ['read:all'],
      },
    },
  ],
};

/**
 * Охват прав, у которых он в имени не записан. Сверку сегодня выполняют
 * резолверы и сервисы; таблица называет охват явно, чтобы он переехал в общий
 * гард вместе с переводом на CASL.
 */
export const marketplaceRightScopes: Record<string, MarketplaceScope> = {
  'Order:create': 'own',
  'Receiving:create': 'own-KU',
  'Receiving:sign:closing': 'own-KU',
  'Receiving:sign:first': 'own',
  'Issuance:create': 'own-KU',
  'Issuance:close': 'own-KU',
  'Issuance:cancel': 'own-KU',
  'Issuance:sign:statement': 'own',
  'Issuance:sign:act': 'own',
  'Inventory:label': 'own-KU',
  'ReturnClaim:decide:remote': 'own-KU',
  'ReturnClaim:decide:on-site': 'own-KU',
  'ReturnClaim:hand-back': 'own-KU',
};

/**
 * Прежняя форма таблицы «роль → ресурс → действия» без условий: что роли
 * положено вообще. Выводится из `marketplaceRightsTable`.
 */
export const marketplaceAccessMatrix: Record<MarketplaceRole, Record<string, string[]>> = rightsByRole(marketplaceRightsTable);

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
export function canAccess(
  roles: MarketplaceRole[],
  resource: string,
  action: string
): boolean {
  return roles.some((role) => {
    const resourceActions = marketplaceAccessMatrix[role]?.[resource];
    return resourceActions ? rightMatches(resourceActions, action) : false;
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

/** Условия строк таблицы, которые дают право ролям пайщика. */
export function conditionsFor(roles: MarketplaceRole[], resource: string, action: string): MarketplaceCondition[][] {
  return rightConditions(marketplaceRightsTable, roles, resource, action);
}

/** Права ролей, действующие при выполненных условиях `held`. */
export function rightsFor(roles: MarketplaceRole[], held: ReadonlySet<MarketplaceCondition>): string[] {
  return rightsHeld(marketplaceRightsTable, roles, held);
}
