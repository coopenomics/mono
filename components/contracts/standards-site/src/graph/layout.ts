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

export function computeProcessFlow(standard: Standard): NavItem[] {
  const items: NavItem[] = [];
  const transitions = standard.transitions ?? [];
  const states = standard.states ?? [];
  const virtualStateNames = new Set(states.filter(isVirtual).map((s) => s.name));
  const hasTerminal = states.some((s) =>
    isTerminalSuccess(s, transitions, virtualStateNames),
  );

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
      (t) => t.from === current && !virtualStateNames.has(t.to),
    );
    if (outs.length === 0) break;
    const chosen = outs[0];
    const actionNodeId = actionNodeIdFor(chosen);
    items.push({
      kind: 'action',
      id: actionNodeId,
      actionName: chosen.action,
      from: chosen.from === INITIAL_MARKER ? START_ID : chosen.from,
      to: chosen.to,
    });
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
  const hasEnd = terminalStates.length > 0;

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
  interface TInfo { t: Transition; actionId: string; targetId: string; isReject: boolean }
  const tInfos: TInfo[] = [];
  for (const t of transitions) {
    const source = t.from === INITIAL_MARKER ? START_ID : t.from;
    const actionId = actionNodeIdFor(t);
    g.setNode(actionId, { ...SIZE.action });

    const isReject = virtualStateNames.has(t.to);
    let targetId: string = t.to;
    if (isReject) {
      targetId = rejectedIdFor(t);
      if (!g.hasNode(targetId)) g.setNode(targetId, { ...SIZE.rejected });
    }

    g.setEdge(source, actionId);
    g.setEdge(actionId, targetId);
    tInfos.push({ t, actionId, targetId, isReject });
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
        summary: standard.summary,
        purpose: standard.purpose ?? '',
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
        summary: standard.summary,
        purpose: standard.purpose ?? '',
        hasRelated: (standard.related ?? []).length > 0,
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
    const { t, actionId, targetId, isReject } = info;
    const pos = g.node(actionId);
    if (!pos) continue;
    const meta = actionMetaByName.get(t.action);

    // Индикаторы: есть ли у действия документы / движения кошелька / бух-проводки.
    const ops = opsByAction.get(t.action) ?? [];
    const hasDocs = (docsByAction.get(t.action) ?? []).length > 0;
    const hasWalletMove = ops.length > 0;
    const hasPosting = ops.some(
      (op) => op.wallet_op !== 'WALLET_ONLY' && (op.debit != null || op.credit != null),
    );

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

    const source = t.from === INITIAL_MARKER ? START_ID : t.from;
    const edgeBaseStyle = isReject
      ? { stroke: 'var(--reject)', strokeDasharray: '5 4', opacity: 0.55 }
      : { stroke: 'var(--border-strong)' };
    const marker = {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: isReject ? 'var(--reject)' : 'var(--border-strong)',
    };

    edges.push({
      id: `e::${source}->${actionId}`,
      source,
      target: actionId,
      type: 'smoothstep',
      style: edgeBaseStyle,
      markerEnd: marker,
    });
    edges.push({
      id: `e::${actionId}->${targetId}`,
      source: actionId,
      target: targetId,
      type: 'smoothstep',
      style: edgeBaseStyle,
      markerEnd: marker,
    });
  }

  // Rejected nodes
  for (const info of tInfos) {
    if (!info.isReject) continue;
    const pos = g.node(info.targetId);
    if (!pos) continue;
    // Добавляем только один раз (если несколько transitions разделяют один rejected-id)
    if (nodes.some((n) => n.id === info.targetId)) continue;
    nodes.push({
      id: info.targetId,
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
