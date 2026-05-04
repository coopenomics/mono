/**
 * TS-зеркало канона кооперативного стандарта.
 *
 * Спецификация: coopenomics-docs/docs/standards/_spec/canon.md
 *
 * Три опциональных поля добавлены под требования графа (не ломают существующие
 * YAML-манифесты):
 *   - states[].kind
 *   - transitions[].guards
 *   - transitions[].operations
 */

// ── Типы-строки для wallet_op / relation / status / role ────────────────────
// Полный набор операций ledger2 (см. _blago L1/L2/L3 spec):
//   ISSUE / TRANSFER / BURN — двигают L2 + опционально L1 + опционально L3
//   BLOCK / UNBLOCK         — только L3 (available ↔ blocked одного кошелька)
//   REVOKE                  — целевое расходование L3.blocked, обычно с L1
//   ACCOUNT_ONLY            — только L1 (бухгалтерская проводка без кошельков)
//   WALLET_ONLY             — legacy: L2 без L1
export type WalletOp =
  | 'ISSUE'
  | 'TRANSFER'
  | 'BURN'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'REVOKE'
  | 'ACCOUNT_ONLY'
  | 'WALLET_ONLY';

export type StandardLifecycle = 'proposed' | 'approved' | 'active' | 'deprecated';

export type StateKind = 'initial' | 'normal' | 'final' | 'virtual';

export type ActionRoleInProcess = 'opener' | 'progress' | 'closer' | 'reject';

export type RelationKind = 'provides' | 'repaid_by' | 'affects' | 'consumes' | 'triggers';

export type Role =
  | 'contributor'
  | 'chairman'
  | 'soviet'
  | 'soviet_members'
  | 'meet'
  | 'gateway_operator'
  | 'administrator'
  | 'chairman_or_soviet'
  // open для расширения без правки типа
  | (string & {});

// ── Элементарные ссылки в ledger2 ───────────────────────────────────────────
// Счета — числовые коды (51, 80, 86); кошельки — eosio::name-строки
// (w.wal.share, w.cap.bgrid). Имена подтягиваются из
// `data/registries.ts` (зеркало source-of-truth из cooptypes/ledger2).
export type AccountCode = number;      // код счёта (51, 80, 86, …)
export type WalletId = string;         // имя кошелька (w.wal.share, w.cap.bgrid, …)

// ── Секции стандарта ────────────────────────────────────────────────────────

// §1 Паспорт — свойства на верхнем уровне
// §2 Действия контракта
export interface ActionLink {
  process_type: string;             // ссылка на другой стандарт
  action?: string;                  // опционально — конкретное действие в нём
  label?: string;                   // подпись кнопки, если не задана — делаем автогенерацию
}

export interface ContractAction {
  name: string;                     // идентификатор: capital::createdebt
  human?: string;                   // короткое человеко-читаемое имя (2–3 слова)
  actor: Role;
  role?: ActionRoleInProcess;       // legacy-поле, в slim убрано
  purpose: string;                  // подробное описание, для панели деталей
  links?: ActionLink[];             // связи с другими стандартами (кнопки-переходы)
}

// §3 Граф состояний
export interface EntityState {
  name: string;                     // машинное имя, как в namespace Status (`created`, `active`…)
  description: string;              // полный смысл — показывается в панели под графом
  human?: string;                   // короткое человеко-читаемое имя (2–3 слова) для квадратика в графе
  kind?: StateKind;                 // добавлено под v1
  virtual?: boolean;                // совместимость со старыми YAML
}

export interface Transition {
  from: string;                     // '∅' для стартового перехода
  to: string;
  action: string;                   // capital::approvedebt
  actor: Role;
  ledger_code?: string;             // если переход порождает операцию ledger2
  guards?: string[];                // условия выхода (v1)
  operations?: string[];            // явный список ledger_code (v1, опционально)
}

// §4 Сценарий
export interface ScenarioParticipant {
  alias: string;
  name?: string;
  role?: Role;
}

export interface ScenarioStep {
  step: number;
  title: string;
  actor: Role;
  action: string;
  description: string;
  pre?: string[];
  post?: string[];
}

export interface ScenarioAlternative {
  branch: string;
  at_step: number;
  action: string;
  actor: Role;
  description: string;
}

export interface Scenario {
  participants?: ScenarioParticipant[];
  steps: ScenarioStep[];
  alternatives?: ScenarioAlternative[];
}

// §5 Документы
export interface ProcessDocument {
  // slim: документ привязан к действию напрямую
  action?: string;                  // capital::createdebt (slim)
  step?: number;                    // legacy: номер шага сценария (до slim)
  title: string;
  registry_id?: number;             // slim: числовой код в реестре документов (100, ...)
  template?: string;                // legacy: строковый ID из draft
  signed_by: Role[];
  stored_in?: string;               // поле таблицы сущности, если хранится on-chain
  note?: string;
}

// §6 Операции — три уровня учёта (L1/L2/L3)
//
// L1 — бухгалтерская проводка: debit / credit (счета 50/76/86/…)
// L2 — переводы между кошельками кооператива: wallet_from / wallet_to
//      (агрегированные балансы кошельков ledger2)
// L3 — движения по кошельку пайщика (per-user available/blocked split):
//      user_wallet, user_ref, available_delta, blocked_delta
//
// Каждая операция указывает только те уровни, которые реально затрагивает.
// Для BLOCK/UNBLOCK имеет смысл только L3. Для TRANSFER user-affecting —
// L1 + L2 + L3 (один и тот же `amount_ref` отражается на всех уровнях).
//
// В YAML указываются только коды/id. Человекочитаемые имена — из registries.
export interface Ledger2Operation {
  ledger_code: string;              // cap.lnissue
  human_name: string;
  wallet_op: WalletOp;
  amount_ref: string;               // debt.amount
  triggered_by: string;             // capital::debtpaycnfrm
  description?: string;

  // L1 — двойная запись (null — операция не затрагивает бухгалтерию)
  debit: AccountCode | null;
  credit: AccountCode | null;

  // L2 — кошельки кооператива (null/'' — операция не двигает L2)
  wallet_from: WalletId | null;
  wallet_to: WalletId | null;

  // L3 — кошелёк пайщика (опционально). Указывается, когда операция
  // затрагивает per-user split available/blocked. Поля независимы от L2 —
  // user_wallet может совпадать по имени с одним из L2-кошельков (для
  // USER_SHARED-кошельков типа w.mkt.member) или быть отдельным.
  user_wallet?: WalletId | null;
  user_ref?: string;                // ссылка на пайщика — order.customer, debt.holder
  available_delta?: string | null;  // выражение по amount_ref: -order.total_cost
  blocked_delta?: string | null;    //                          +order.total_cost
}

// §7 Связи
export interface RelatedStandard {
  process_type: string | null;
  id?: string;                      // public_capital_..._process (если есть)
  relation: RelationKind;
  note: string;
}

// ── Корневой тип манифеста ──────────────────────────────────────────────────
export interface Standard {
  // §1 Паспорт
  process_type: string;             // cap.loan
  id?: string;                      // public_capital_debt_process
  title: string;
  slug: string;
  status: StandardLifecycle;
  contract: string;                 // capital, registrator, ...
  area?: string;                    // debt_managment
  summary: string;
  purpose?: string;
  roles: Role[];

  // §2
  actions: ContractAction[];

  // §3
  entity?: string;                  // технический идентификатор (`wallet::deposit`)
  entity_human?: string;            // человекочитаемое имя, им. падеж ед. ч. («Заявка на взнос»)
  entity_source?: string;
  states: EntityState[];
  transitions: Transition[];

  // §4
  scenario: Scenario;

  // §5
  documents: ProcessDocument[];

  // §6
  operations: Ledger2Operation[];

  // §7
  related?: RelatedStandard[];
}

// ── Мета: индекс всех стандартов для sidebar + роутинга ─────────────────────
export interface StandardIndexEntry {
  process_type: string;
  title: string;
  contract: string;
  slug: string;
  path: string;                     // путь к исходному YAML относительно repo
  status: StandardLifecycle;
}

export interface StandardIndex {
  byProcessType: Record<string, Standard>;
  byContract: Record<string, StandardIndexEntry[]>;
  contracts: string[];              // отсортированный список контрактов
}
