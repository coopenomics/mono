/**
 * Линейная модель процесса для текстового представления стандарта.
 *
 * Стандарт хранит сценарий, переходы, документы и операции отдельными
 * секциями. Для чтения их нужно свести в одну последовательность: шаг
 * сценария → какие переходы статуса он делает → какие операции и документы
 * возникают на этом шаге → какие ответвления от него отходят.
 *
 * Связь секций идёт через имя действия контракта: `transitions[].action`,
 * `documents[].action` (или legacy `documents[].step`), `operations[].triggered_by`.
 * Если сценария нет, шаги строятся по переходам графа.
 */

import type {
  Standard,
  ScenarioStep,
  Transition,
  ProcessDocument,
  Ledger2Operation,
} from '@/types/standard';
import { getAccount, getWallet } from '@/data/registries';
import { roleHuman } from '@/data/labels';

export const NONE_STATE = '∅';

export interface StateChange {
  from: string;
  to: string;
  fromHuman: string;
  toHuman: string;
  guards: string[];
}

export interface PostingRow {
  op: Ledger2Operation;
  debit: { code: number; name: string } | null;
  credit: { code: number; name: string } | null;
}

export interface WalletRow {
  op: Ledger2Operation;
  from: { id: string; name: string } | null;
  to: { id: string; name: string } | null;
}

/** Точка процесса — основной шаг или ответвление от него. */
export interface ProcessPoint {
  anchor: string;               // id якоря в тексте
  label: string;                // «Шаг 3», «Ответвление 3.1»
  number: string;               // «3», «3.1» — для схемы
  title: string;
  actor: string;
  actorHuman: string;
  action: string | null;
  actionHuman: string | null;
  description: string;
  pre: string[];
  post: string[];
  changes: StateChange[];
  operations: Ledger2Operation[];
  documents: ProcessDocument[];
}

export interface ProcessStepModel extends ProcessPoint {
  kind: 'step';
  alternatives: ProcessBranchModel[];
}

export interface ProcessBranchModel extends ProcessPoint {
  kind: 'branch';
  parent: string;               // номер основного шага
}

/** Строка сводки: где в процессе возникает операция или документ. */
export interface Placement {
  /** Все точки процесса, где возникает запись, в порядке процесса. Пусто — вне сценария. */
  points: ProcessPoint[];
}

export interface ProcessModel {
  steps: ProcessStepModel[];
  derivedFromTransitions: boolean;
  /** Действия стандарта, которых нет ни в шагах, ни в ответвлениях. */
  extra: ProcessPoint[];
  postings: (PostingRow & Placement)[];
  wallets: (WalletRow & Placement)[];
  documents: (Placement & { doc: ProcessDocument })[];
  actors: { id: string; human: string }[];
}

function splitStates(value: string): string[] {
  return value.split('|').map((s) => s.trim()).filter(Boolean);
}

function stateHumanFn(standard: Standard): (name: string) => string {
  const map = new Map(standard.states.map((s) => [s.name, s.human ?? s.name]));
  return (name: string) =>
    splitStates(name)
      .map((n) => (n === NONE_STATE ? NONE_STATE : (map.get(n) ?? n)))
      .join(' / ');
}

function actionHumanFn(standard: Standard): (name: string | null | undefined) => string | null {
  const map = new Map(standard.actions.map((a) => [a.name, a.human ?? null]));
  return (name) => {
    if (!name) return null;
    return map.get(name) ?? null;
  };
}

/**
 * Операции, порождённые действием. `triggered_by` бывает списком через запятую или `|`
 * и иногда содержит пояснение после имени действия — сверяем по началу.
 */
function opsFor(standard: Standard, action: string | null): Ledger2Operation[] {
  if (!action) return [];
  return standard.operations.filter((op) =>
    (op.triggered_by ?? '')
      .split(/[,|]/)
      .map((t) => t.trim())
      .some((t) => t === action || t.startsWith(`${action} `) || t.startsWith(`${action}(`)),
  );
}

function changesFor(standard: Standard, action: string | null): StateChange[] {
  if (!action) return [];
  const human = stateHumanFn(standard);
  return standard.transitions
    .filter((t) => t.action === action)
    .map((t) => ({
      from: t.from,
      to: t.to,
      fromHuman: human(t.from),
      toHuman: human(t.to),
      guards: t.guards ?? [],
    }));
}

function docsFor(
  standard: Standard,
  action: string | null,
  stepNumber: string | null,
): ProcessDocument[] {
  return standard.documents.filter((d) => {
    if (d.action) return action != null && d.action === action;
    if (d.step != null) return stepNumber != null && String(d.step) === stepNumber;
    return false;
  });
}

/** Якорь строки внутри шага: операции или документа. */
export function factAnchor(point: { anchor: string }, kind: 'op' | 'doc', key: string): string {
  return anchorId(`${point.anchor}--${kind}`, key);
}

function anchorId(prefix: string, value: string): string {
  return `${prefix}-${value.replace(/[^0-9a-zA-Zа-яА-Я_-]+/g, '_')}`;
}

function stepsFromTransitions(standard: Standard): ScenarioStep[] {
  const human = stateHumanFn(standard);
  const actionHuman = actionHumanFn(standard);
  const seen = new Set<string>();
  const out: ScenarioStep[] = [];
  let n = 1;
  for (const t of standard.transitions as Transition[]) {
    if (seen.has(t.action)) continue;
    seen.add(t.action);
    const meta = standard.actions.find((a) => a.name === t.action);
    out.push({
      step: n++,
      title: actionHuman(t.action) ?? t.action,
      actor: t.actor,
      action: t.action,
      description: meta?.purpose ?? `${human(t.from)} → ${human(t.to)}`,
    });
  }
  // Действия без переходов (чистые операции) — в конец, в порядке объявления.
  for (const a of standard.actions) {
    if (seen.has(a.name)) continue;
    seen.add(a.name);
    out.push({
      step: n++,
      title: a.human ?? a.name,
      actor: a.actor,
      action: a.name,
      description: a.purpose,
    });
  }
  return out;
}

/** Часть стандартов опускает пустые секции — приводим их к пустым массивам. */
function normalize(raw: Standard): Standard {
  return {
    ...raw,
    actions: raw.actions ?? [],
    states: raw.states ?? [],
    transitions: raw.transitions ?? [],
    documents: raw.documents ?? [],
    operations: raw.operations ?? [],
    scenario: raw.scenario ?? { steps: [] },
  };
}

export function buildProcessModel(raw: Standard): ProcessModel {
  const standard = normalize(raw);
  const actionHuman = actionHumanFn(standard);
  const scenarioSteps = standard.scenario?.steps ?? [];
  const derivedFromTransitions = scenarioSteps.length === 0;
  const rawSteps = derivedFromTransitions ? stepsFromTransitions(standard) : scenarioSteps;
  const alternatives = derivedFromTransitions ? [] : (standard.scenario?.alternatives ?? []);

  const actorIds = new Set<string>();

  const steps: ProcessStepModel[] = rawSteps.map((s) => {
    const number = String(s.step);
    const action = s.action ?? null;
    actorIds.add(s.actor);
    return {
      kind: 'step',
      anchor: anchorId('step', number),
      label: `Шаг ${number}`,
      number,
      title: s.title,
      actor: s.actor,
      actorHuman: roleHuman(s.actor),
      action,
      actionHuman: actionHuman(action),
      description: (s.description ?? '').trim(),
      pre: s.pre ?? [],
      post: s.post ?? [],
      changes: changesFor(standard, action),
      operations: opsFor(standard, action),
      documents: docsFor(standard, action, number),
      alternatives: [],
    };
  });

  const byNumber = new Map(steps.map((s) => [s.number, s]));
  for (const alt of alternatives) {
    const parent = byNumber.get(String(alt.at_step));
    if (!parent) continue;
    const idx = parent.alternatives.length + 1;
    const number = `${parent.number}.${idx}`;
    const action = alt.action ?? null;
    actorIds.add(alt.actor);
    parent.alternatives.push({
      kind: 'branch',
      parent: parent.number,
      anchor: anchorId('alt', number),
      label: `Ответвление ${number}`,
      number,
      title: alt.branch,
      actor: alt.actor,
      actorHuman: roleHuman(alt.actor),
      action,
      actionHuman: actionHuman(action),
      description: (alt.description ?? '').trim(),
      pre: [],
      post: [],
      // Ответвление с тем же действием, что и основной шаг, — вариант
      // исполнения шага: переходы и операции у него те же, не дублируем.
      changes: action === parent.action ? [] : changesFor(standard, action),
      operations: action === parent.action ? [] : opsFor(standard, action),
      documents: action === parent.action ? [] : docsFor(standard, action, null),
    });
  }

  // Действия, не попавшие в сценарий.
  const covered = new Set<string>();
  for (const s of steps) {
    if (s.action) covered.add(s.action);
    for (const a of s.alternatives) if (a.action) covered.add(a.action);
  }
  const extra: ProcessPoint[] = standard.actions
    .filter((a) => !covered.has(a.name))
    .map((a) => {
      actorIds.add(a.actor);
      return {
        anchor: anchorId('extra', a.name),
        label: 'Вне сценария',
        number: '',
        title: a.human ?? a.name,
        actor: a.actor,
        actorHuman: roleHuman(a.actor),
        action: a.name,
        actionHuman: a.human ?? null,
        description: (a.purpose ?? '').trim(),
        pre: [],
        post: [],
        changes: changesFor(standard, a.name),
        operations: opsFor(standard, a.name),
        documents: docsFor(standard, a.name, null),
      };
    });

  // Порядок процесса: шаг → его ответвления → следующий шаг → … → вне сценария.
  const ordered: ProcessPoint[] = [];
  for (const s of steps) {
    ordered.push(s, ...s.alternatives);
  }
  ordered.push(...extra);

  const postings: ProcessModel['postings'] = [];
  const wallets: ProcessModel['wallets'] = [];
  const documents: ProcessModel['documents'] = [];
  const opPlaces = new Map<Ledger2Operation, ProcessPoint[]>();
  const docPlaces = new Map<ProcessDocument, ProcessPoint[]>();

  const addOp = (op: Ledger2Operation): void => {
    if (opPlaces.has(op)) return;
    const points: ProcessPoint[] = [];
    opPlaces.set(op, points);
    if (op.debit != null || op.credit != null) {
      const d = op.debit != null ? getAccount(op.debit) : undefined;
      const c = op.credit != null ? getAccount(op.credit) : undefined;
      postings.push({
        op,
        points,
        debit: op.debit != null ? { code: op.debit, name: d?.name ?? '' } : null,
        credit: op.credit != null ? { code: op.credit, name: c?.name ?? '' } : null,
      });
    }
    if (op.wallet_op && op.wallet_op !== 'NONE' && (op.wallet_from || op.wallet_to)) {
      const f = op.wallet_from ? getWallet(op.wallet_from) : undefined;
      const t = op.wallet_to ? getWallet(op.wallet_to) : undefined;
      wallets.push({
        op,
        points,
        from: op.wallet_from ? { id: op.wallet_from, name: f?.human_name ?? '' } : null,
        to: op.wallet_to ? { id: op.wallet_to, name: t?.human_name ?? '' } : null,
      });
    }
  };

  const addDoc = (doc: ProcessDocument): void => {
    if (docPlaces.has(doc)) return;
    const points: ProcessPoint[] = [];
    docPlaces.set(doc, points);
    documents.push({ doc, points });
  };

  // Сводки в порядке процесса: строка появляется при первом упоминании,
  // дальше к ней добавляются остальные шаги, где запись повторяется.
  for (const p of ordered) {
    for (const op of p.operations) {
      addOp(op);
      opPlaces.get(op)!.push(p);
    }
    for (const doc of p.documents) {
      addDoc(doc);
      docPlaces.get(doc)!.push(p);
    }
  }
  for (const op of standard.operations) addOp(op);
  for (const doc of standard.documents) addDoc(doc);

  return {
    steps,
    derivedFromTransitions,
    extra,
    postings,
    wallets,
    documents,
    actors: [...actorIds].map((id) => ({ id, human: roleHuman(id) })),
  };
}
