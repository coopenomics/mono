/**
 * Связи между стандартами.
 *
 * Процессы ссылаются друг на друга тремя способами:
 *   • `related[]` — явная связь с описанием;
 *   • `actions[].links[]` — кнопка-переход у действия;
 *   • `operations[].triggered_by` — операция одного стандарта порождается
 *     действием другого (например, оплату расхода участка проводит действие
 *     общего процесса расходов `expense::payexp`).
 *
 * Здесь по всему реестру ищутся: где в чужом процессе находится действие,
 * какие чужие операции порождает действие этого процесса и какие процессы
 * связаны с данным в обе стороны.
 */

import type { Ledger2Operation, ProcessDocument, RelationKind, Standard } from '@/types/standard';
import { standardsIndex } from '@/data/loader';
import { buildProcessModel, type ProcessModel, type ProcessPoint } from '@/data/process-model';

const modelCache = new Map<string, ProcessModel>();

export function modelOf(standard: Standard): ProcessModel {
  let m = modelCache.get(standard.process_type);
  if (!m) {
    m = buildProcessModel(standard);
    modelCache.set(standard.process_type, m);
  }
  return m;
}

function allStandards(): Standard[] {
  return Object.values(standardsIndex.byProcessType);
}

/** Имена действий из `triggered_by` (список через запятую или `|`, пояснения отбрасываем). */
export function triggerActions(op: Ledger2Operation): string[] {
  return (op.triggered_by ?? '')
    .split(/[,|]/)
    .map((t) => t.trim().split(/[\s(]/)[0])
    .filter((t) => t.includes('::'));
}

/** Место действия в другом стандарте. */
export interface ForeignPlace {
  standard: Standard;
  point: ProcessPoint | null;
}

/** Где в реестре (кроме самого стандарта) описано действие. */
export function findAction(action: string, except: string): ForeignPlace | null {
  for (const s of allStandards()) {
    if (s.process_type === except) continue;
    if (!(s.actions ?? []).some((a) => a.name === action)) continue;
    const m = modelOf(s);
    const points: ProcessPoint[] = [];
    for (const st of m.steps) points.push(st, ...st.alternatives);
    points.push(...m.extra);
    return { standard: s, point: points.find((p) => p.action === action) ?? null };
  }
  return null;
}

/** Операции других стандартов, которые порождает действие этого. */
export interface ForeignOp {
  op: Ledger2Operation;
  standard: Standard;
}

export function foreignOpsFor(action: string, self: string): ForeignOp[] {
  const out: ForeignOp[] = [];
  for (const s of allStandards()) {
    if (s.process_type === self) continue;
    for (const op of s.operations ?? []) {
      if (triggerActions(op).includes(action)) out.push({ op, standard: s });
    }
  }
  return out;
}

// ── Связанные процессы ──────────────────────────────────────────────────────

export const RELATION_HUMAN: Record<RelationKind, string> = {
  provides: 'обслуживает',
  consumes: 'использует',
  triggers: 'запускает',
  affects: 'влияет на',
  repaid_by: 'погашается процессом',
};

export interface RelatedLink {
  standard: Standard | null;
  processType: string | null;
  relation: string;
  note: string;
  /** Связь объявлена в другом стандарте и показана здесь в обратную сторону. */
  reverse: boolean;
}

export function relatedOf(standard: Standard): RelatedLink[] {
  const out: RelatedLink[] = [];
  const seen = new Set<string>();
  const push = (link: RelatedLink): void => {
    const key = link.processType ?? `${link.note}`;
    if (link.processType && seen.has(key)) return;
    seen.add(key);
    out.push(link);
  };

  for (const r of standard.related ?? []) {
    push({
      standard: r.process_type ? (standardsIndex.byProcessType[r.process_type] ?? null) : null,
      processType: r.process_type,
      relation: RELATION_HUMAN[r.relation] ?? r.relation,
      note: r.note,
      reverse: false,
    });
  }
  for (const a of standard.actions ?? []) {
    for (const l of a.links ?? []) {
      push({
        standard: standardsIndex.byProcessType[l.process_type] ?? null,
        processType: l.process_type,
        relation: 'переход из действия',
        note: `${a.human ?? a.name}: ${l.label ?? ''}`.trim(),
        reverse: false,
      });
    }
  }
  // Обратные связи: кто ссылается на этот стандарт.
  for (const s of allStandards()) {
    if (s.process_type === standard.process_type) continue;
    const r = (s.related ?? []).find((x) => x.process_type === standard.process_type);
    const linked = (s.actions ?? []).some((a) =>
      (a.links ?? []).some((l) => l.process_type === standard.process_type),
    );
    const triggered = (s.operations ?? []).some((op) =>
      triggerActions(op).some((t) => (standard.actions ?? []).some((a) => a.name === t)),
    );
    if (!r && !linked && !triggered) continue;
    push({
      standard: s,
      processType: s.process_type,
      relation: 'ссылается сюда',
      note: r?.note ?? (triggered ? 'Операции этого процесса проводят действия текущего.' : 'Переход из действия.'),
      reverse: true,
    });
  }
  return out;
}

/** Документы связанных процессов — оформляются там, а не здесь. */
export interface ForeignDoc {
  doc: ProcessDocument;
  standard: Standard;
  point: ProcessPoint | null;
}

export function relatedDocs(standard: Standard): ForeignDoc[] {
  const out: ForeignDoc[] = [];
  for (const r of standard.related ?? []) {
    // Документы берём только у процессов, которые этот использует: там
    // оформляется то, без чего этот процесс не проходит.
    if (r.relation !== 'consumes' || !r.process_type) continue;
    const link = { standard: standardsIndex.byProcessType[r.process_type] ?? null };
    if (!link.standard) continue;
    const m = modelOf(link.standard);
    for (const d of m.documents) out.push({ doc: d.doc, standard: link.standard, point: d.points[0] ?? null });
  }
  return out;
}
