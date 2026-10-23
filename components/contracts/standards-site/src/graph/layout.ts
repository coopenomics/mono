/**
 * Раскладка графа процесса — расширенная BPMN-подобная нотация.
 *
 * Узлы:
 *   • start         — начало (∅)
 *   • state / end   — статус / финал (прямоугольник со скруглениями / двойной обводкой)
 *   • rejected      — отказ (красный маленький)
 *   • action        — действие контракта (прямоугольник между статусами)
 *   • document      — документ (карточка над action)
 *   • operation     — ledger2-операция (карточка под action)
 *
 * Связи:
 *   • state → action, action → state/rejected       — через dagre LR-раскладку
 *   • action → document                              — вручную, вверх
 *   • action → operation                             — вручную, вниз
 *
 * Мемо-кэш: раскладка одного `process_type` считается один раз и переиспользуется
 * при смене фокуса (меняется только data.isFocus на соответствующем узле).
 */

import dagre from '@dagrejs/dagre';
import type { Node, Edge, Position } from '@vue-flow/core';
import { MarkerType } from '@vue-flow/core';
import type {
  Standard,
  EntityState,
  Transition,
  ProcessDocument,
  Ledger2Operation,
} from '@/types/standard';

// ── Константы ───────────────────────────────────────────────────────────────
export const NODE_TYPES = {
  START: 'start',
  STATE: 'state',
  END: 'end',
  REJECTED: 'rejected',
  ACTION: 'action',
} as const;

export const START_ID = '__start__';
export const END_ID = '__end__';
export const INITIAL_MARKER = '∅';

/* В dagre-боксе для start/end оставляем широкий «воздушный» footprint,
   чтобы кружок не прилипал к первой/последней карточке. Визуальный
   кружок (48px) центрируется внутри wrapper-а в соответствующем узле. */
/* В dagre-боксе для start/end оставляем широкий «воздушный» footprint,
   чтобы кружок не прилипал к первой/последней карточке. Визуальный
   кружок (48px) центрируется внутри wrapper-а в соответствующем узле. */
const SIZE = {
  start: { width: 128, height: 96 },
  state: { width: 220, height: 96 },
  end: { width: 128, height: 96 },
  rejected: { width: 120, height: 70 },
  action: { width: 210, height: 68 },
};

// ── Вспомогательные ─────────────────────────────────────────────────────────
function actionShort(name: string): string {
  return name.split('::').pop() ?? name;
}

function isVirtual(s: EntityState): boolean {
  return s.kind === 'virtual' || s.virtual === true;
}

function rejectedIdFor(t: Transition): string {
  const from = t.from === INITIAL_MARKER ? 'start' : t.from;
  return `__rejected__${from}__${actionShort(t.action)}`;
}

function actionNodeIdFor(t: Transition): string {
  const from = t.from === INITIAL_MARKER ? START_ID : t.from;
  return `action::${from}::${actionShort(t.action)}::${t.to}`;
}

/** Перечисление статусов через `|`: «accepted | supplyprep» — переход из любого. */
function splitStates(value: string): string[] {
  return value.split('|').map((x) => x.trim()).filter(Boolean);
}

/**
 * Переход в «∅» — контракт удаляет запись, процесс для неё закончился.
 * С основного пути сценария это успешное завершение (стрелка в финиш),
 * из ответвления или действием-отказом — завершение отказом.
 */
function isRemoval(t: Transition): boolean {
  return t.to === INITIAL_MARKER;
}

function removalIsSuccess(standard: Standard, t: Transition, rejectActionNames: Set<string>): boolean {
  if (rejectActionNames.has(t.action) || looksLikeRejectAction(t.action)) return false;
  const main = new Set((standard.scenario?.steps ?? []).map((st) => st.action).filter(Boolean));
  return main.size === 0 || main.has(t.action);
}

function rejectNamesOf(standard: Standard): Set<string> {
  return new Set((standard.actions ?? []).filter((a) => a.role === 'reject').map((a) => a.name));
}

function isTerminalSuccess(
  state: EntityState,
  transitions: Transition[],
  virtualSet: Set<string>,
): boolean {
  if (isVirtual(state)) return false;
  if (state.kind === 'final') return true;
  const outs = transitions.filter(
    (t) => t.from === state.name && !virtualSet.has(t.to),
  );
  return outs.length === 0;
}

// Построить мапы «action → [documents]» и «action → [operations]»
// slim: doc.action — прямая привязка. Legacy: doc.step + scenario.steps.
function buildDocsByAction(standard: Standard): Map<string, ProcessDocument[]> {
  const map = new Map<string, ProcessDocument[]>();
  const stepToAction = new Map<number, string>();
  for (const step of standard.scenario?.steps ?? []) {
    stepToAction.set(step.step, step.action);
  }
  for (const doc of standard.documents ?? []) {
    const action = doc.action ?? (doc.step != null ? stepToAction.get(doc.step) : undefined);
    if (!action) continue;
    const list = map.get(action) ?? [];
    list.push(doc);
    map.set(action, list);
  }
  return map;
}

function buildOpsByAction(standard: Standard): Map<string, Ledger2Operation[]> {
  const map = new Map<string, Ledger2Operation[]>();
  for (const op of standard.operations ?? []) {
    const list = map.get(op.triggered_by) ?? [];
    list.push(op);
    map.set(op.triggered_by, list);
  }
  return map;
}

// ── Процесс-поток для навигации (state ↔ action) ───────────────────────────
export interface NavItem {
  kind: 'state' | 'action';
  id: string;                // state: имя статуса или START_ID; action: action-node id
  actionName?: string;       // для action: полное имя `registrator::confirmreg`
  from?: string;
  to?: string;
}

// Эвристика «happy-path»: action-имена, которые уводят на ветку отмены/отказа.
// Сюда же относится legacy-поле `actions[].role === 'reject'` (если задано).
// Когда из текущего статуса несколько transitions, при выборе следующего шага
// штрафуем reject-кандидатов и предпочитаем тех, чей target имеет продолжение.
const REJECT_ACTION_KEYWORDS = [
  'cancel',
  'decline',
  'expire',
  'reject',
  'abort',
  'abandon',
  'fail',
  'revoke',
  'discard',
];

function looksLikeRejectAction(actionName: string): boolean {
  const short = actionShort(actionName).toLowerCase();
  return REJECT_ACTION_KEYWORDS.some((kw) => short.includes(kw));
}

function pickHappyTransition(
  outs: Transition[],
  allTransitions: Transition[],
  virtualSet: Set<string>,
  rejectActionNames: Set<string>,
): Transition {
  if (outs.length === 1) return outs[0];
  const scored = outs.map((t, idx) => {
    const isReject = rejectActionNames.has(t.action) || looksLikeRejectAction(t.action);
    // Самопетля (from === to) — внутренний sub-step, не двигает цепочку:
    // walk-loop сразу остановится на visited.has(to). Штрафуем.
    const isSelfLoop = t.from === t.to;
    // Если из target-статуса есть исходящие переходы — путь продолжается,
    // это аргумент в пользу happy-ветки (отказы обычно сразу терминальны).
    const targetHasContinuation = allTransitions.some(
      (next) => next.from === t.to && !virtualSet.has(next.to),
    );
    return { t, idx, isReject, isSelfLoop, targetHasContinuation };
  });
  scored.sort((a, b) => {
    if (a.isReject !== b.isReject) return a.isReject ? 1 : -1;
    if (a.isSelfLoop !== b.isSelfLoop) return a.isSelfLoop ? 1 : -1;
    if (a.targetHasContinuation !== b.targetHasContinuation) {
      return a.targetHasContinuation ? -1 : 1;
    }
    return a.idx - b.idx;
  });
  return scored[0].t;
}

export function computeProcessFlow(standard: Standard): NavItem[] {
  const items: NavItem[] = [];
  const transitions = standard.transitions ?? [];
  const states = standard.states ?? [];
  const virtualStateNames = new Set(states.filter(isVirtual).map((s) => s.name));
  // legacy: actions[].role === 'reject' — явная пометка отказа в манифесте
  const rejectActionNames = rejectNamesOf(standard);
  const successRemoval = (t: Transition) => isRemoval(t) && removalIsSuccess(standard, t, rejectActionNames);
  const hasTerminal =
    states.some((s) => isTerminalSuccess(s, transitions, virtualStateNames)) ||
    transitions.some(successRemoval);

  const hasStart = transitions.some((t) => t.from === INITIAL_MARKER);
  let current: string;
  if (hasStart) {
    items.push({ kind: 'state', id: START_ID });
    current = INITIAL_MARKER;
  } else {
    const first = states.find((s) => !isVirtual(s));
    if (!first) return items;
    items.push({ kind: 'state', id: first.name });
    current = first.name;
  }

  const visited = new Set<string>([current]);
  while (true) {
    const outs = transitions.filter(
      (t) =>
        splitStates(t.from).includes(current) &&
        !virtualStateNames.has(t.to) &&
        // Удаление записи по отказу — не основной путь.
        (!isRemoval(t) || successRemoval(t)) &&
        // Действие вне процесса «∅ → ∅» основной путь не продолжает.
        !(t.from === INITIAL_MARKER && isRemoval(t)),
    );
    if (outs.length === 0) break;
    const chosen = pickHappyTransition(
      outs,
      transitions,
      virtualStateNames,
      rejectActionNames,
    );
    const actionNodeId = actionNodeIdFor(chosen);
    items.push({
      kind: 'action',
      id: actionNodeId,
      actionName: chosen.action,
      from: chosen.from === INITIAL_MARKER ? START_ID : chosen.from,
      to: isRemoval(chosen) ? END_ID : chosen.to,
    });
    // Удаление записи — финиш процесса: дальше идти некуда.
    if (isRemoval(chosen)) break;
    items.push({ kind: 'state', id: chosen.to });
    if (visited.has(chosen.to)) break;
    visited.add(chosen.to);
    current = chosen.to;
  }
  if (hasTerminal) items.push({ kind: 'state', id: END_ID });
  return items;
}

// ── Layout ──────────────────────────────────────────────────────────────────
export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

const layoutCache = new Map<string, LayoutResult>();

function buildLayout(standard: Standard): LayoutResult {
  const transitions = standard.transitions ?? [];
  const states = standard.states ?? [];
  const actions = standard.actions ?? [];
  const actionMetaByName = new Map(actions.map((a) => [a.name, a]));
  const docsByAction = buildDocsByAction(standard);
  const opsByAction = buildOpsByAction(standard);

  const virtualStateNames = new Set(states.filter(isVirtual).map((s) => s.name));
  const terminalStates = states.filter((s) =>
    isTerminalSuccess(s, transitions, virtualStateNames),
  );
  const rejectActionNames = rejectNamesOf(standard);
  const hasEnd =
    terminalStates.length > 0 ||
    transitions.some((t) => isRemoval(t) && removalIsSuccess(standard, t, rejectActionNames));

  // ── Dagre: states + actions + rejected nodes (для basic LR-раскладки) ───
  const g = new dagre.graphlib.Graph({ directed: true });
  g.setGraph({
    rankdir: 'LR',
    nodesep: 52,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const hasStart = transitions.some((t) => t.from === INITIAL_MARKER);
  if (hasStart) g.setNode(START_ID, { ...SIZE.start });
  if (hasEnd) g.setNode(END_ID, { ...SIZE.end });

  for (const s of states) {
    if (isVirtual(s)) continue;
    g.setNode(s.name, { ...SIZE.state });
  }

  // Ребро от каждого «финального» статуса к общему ● финиш-узлу
  for (const s of terminalStates) {
    g.setEdge(s.name, END_ID);
  }

  // Action-узлы + потенциальные rejected-узлы
  interface TInfo { t: Transition; actionId: string; targetIds: string[]; isReject: boolean }
  const sourcesOf = (t: Transition): string[] =>
    t.from === INITIAL_MARKER ? [START_ID] : splitStates(t.from);
  const tInfos: TInfo[] = [];
  for (const t of transitions) {
    const actionId = actionNodeIdFor(t);
    g.setNode(actionId, { ...SIZE.action });

    const removal = isRemoval(t);
    const isReject =
      virtualStateNames.has(t.to) || (removal && !removalIsSuccess(standard, t, rejectActionNames));
    let targetIds: string[] = splitStates(t.to);
    if (isReject) {
      const rid = rejectedIdFor(t);
      if (!g.hasNode(rid)) g.setNode(rid, { ...SIZE.rejected });
      targetIds = [rid];
    } else if (removal) {
      targetIds = [END_ID];
    }

    for (const src of sourcesOf(t)) g.setEdge(src, actionId);
    for (const tid of targetIds) g.setEdge(actionId, tid);
    tInfos.push({ t, actionId, targetIds, isReject });
  }

  dagre.layout(g);

  // ── Конвертируем в Vue Flow ─────────────────────────────────────────────
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const TL: Position = 'left' as Position;
  const TR: Position = 'right' as Position;

  // Start
  if (hasStart) {
    const pos = g.node(START_ID);
    nodes.push({
      id: START_ID,
      type: NODE_TYPES.START,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: {
        label: INITIAL_MARKER,
        title: standard.title,
        purpose: standard.purpose,
        isFocus: false,
      },
      draggable: false,
      targetPosition: TL,
      sourcePosition: TR,
    });
  }

  // Statuses — все рендерятся как прямоугольник `state`.
  // Финальные статусы теперь подключаются к отдельному ●-финиш-узлу.
  const entityHuman = standard.entity_human ?? '';
  for (const s of states) {
    if (isVirtual(s)) continue;
    const pos = g.node(s.name);
    if (!pos) continue;
    nodes.push({
      id: s.name,
      type: NODE_TYPES.STATE,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: {
        label: s.name,
        human: s.human,
        description: s.description,
        entity: entityHuman,
        isFocus: false,
      },
      draggable: false,
      targetPosition: TL,
      sourcePosition: TR,
    });
  }

  // End (● финиш-кружок): один на весь процесс; собирает стрелки от всех
  // успешно-терминальных статусов.
  if (hasEnd) {
    const pos = g.node(END_ID);
    nodes.push({
      id: END_ID,
      type: NODE_TYPES.END,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: {
        label: '●',
        title: standard.title,
        purpose: standard.purpose,
        isFocus: false,
      },
      draggable: false,
      targetPosition: TL,
      sourcePosition: TR,
    });
    const endEdgeStyle = { stroke: 'var(--border-strong)' };
    const endMarker = {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: 'var(--border-strong)',
    };
    for (const s of terminalStates) {
      edges.push({
        id: `e::${s.name}->${END_ID}`,
        source: s.name,
        target: END_ID,
        type: 'smoothstep',
        style: endEdgeStyle,
        markerEnd: endMarker,
      });
    }
  }

  // Actions + linked state→action, action→target edges
  for (const info of tInfos) {
    const { t, actionId, targetIds, isReject } = info;
    const pos = g.node(actionId);
    if (!pos) continue;
    const meta = actionMetaByName.get(t.action);

    // Индикаторы: есть ли у действия документы / движения кошелька / бух-проводки.
    const ops = opsByAction.get(t.action) ?? [];
    const hasDocs = (docsByAction.get(t.action) ?? []).length > 0;
    const hasWalletMove = ops.length > 0;
    const hasPosting = ops.some((op) => op.debit != null || op.credit != null);

    nodes.push({
      id: actionId,
      type: NODE_TYPES.ACTION,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: {
        actionName: t.action,
        short: actionShort(t.action),
        human: meta?.human ?? actionShort(t.action),
        actor: t.actor,
        role: meta?.role ?? 'progress',
        isReject,
        isFocus: false,
        hasDocs,
        hasWalletMove,
        hasPosting,
      },
      draggable: false,
      targetPosition: TL,
      sourcePosition: TR,
    });

    const edgeBaseStyle = isReject
      ? { stroke: 'var(--reject)', strokeDasharray: '5 4', opacity: 0.55 }
      : { stroke: 'var(--border-strong)' };
    const marker = {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: isReject ? 'var(--reject)' : 'var(--border-strong)',
    };

    for (const source of sourcesOf(t)) {
      edges.push({
        id: `e::${source}->${actionId}`,
        source,
        target: actionId,
        type: 'smoothstep',
        style: edgeBaseStyle,
        markerEnd: marker,
      });
    }
    for (const targetId of targetIds) {
      edges.push({
        id: `e::${actionId}->${targetId}`,
        source: actionId,
        target: targetId,
        type: 'smoothstep',
        style: edgeBaseStyle,
        markerEnd: marker,
      });
    }
  }

  // Rejected nodes
  for (const info of tInfos) {
    if (!info.isReject) continue;
    const rid = info.targetIds[0];
    const pos = g.node(rid);
    if (!pos) continue;
    // Добавляем только один раз (если несколько transitions разделяют один rejected-id)
    if (nodes.some((n) => n.id === rid)) continue;
    nodes.push({
      id: rid,
      type: NODE_TYPES.REJECTED,
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: {
        label: '×',
        actionShort: actionShort(info.t.action),
        actionName: info.t.action,
        virtualState: info.t.to,
        isFocus: false,
      },
      draggable: false,
      targetPosition: TL,
      sourcePosition: TR,
    });
  }

  return { nodes, edges };
}

/**
 * Публичная функция: возвращает layout с учётом фокусного элемента.
 * Позиции не меняются при смене фокуса — меняются только `isFocus` в data.
 */
export function layoutStandard(
  standard: Standard,
  focusStatus: string | null,
  focusAction: string | null = null,
  focusDocument: string | null = null,
  focusOperation: string | null = null,
): LayoutResult {
  let cached = layoutCache.get(standard.process_type);
  if (!cached) {
    cached = buildLayout(standard);
    layoutCache.set(standard.process_type, cached);
  }
  // focusDocument/focusOperation используются только в FocusBar — здесь
  // они влияют только на слабое подсвечивание индикатора у action, если
  // это тот самый action. Пока только action / state подсвечиваются.
  void focusDocument;
  void focusOperation;

  return {
    nodes: cached.nodes.map((n) => {
      let isFocus = false;
      if (n.type === NODE_TYPES.ACTION) {
        isFocus = (n.data as { actionName?: string })?.actionName === focusAction;
      } else {
        isFocus = n.id === focusStatus;
      }
      return {
        ...n,
        data: { ...n.data, isFocus },
      };
    }),
    edges: cached.edges,
  };
}
