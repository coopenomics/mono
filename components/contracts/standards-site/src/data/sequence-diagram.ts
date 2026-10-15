/**
 * Модель процесса → текст диаграммы последовательности Mermaid.
 *
 * Участники: роли процесса, контракт, учёт (кошельки и проводки) и реестр
 * документов. Каждый шаг — сообщение роли контракту с номером шага в начале
 * подписи («3. Акцепт заявки»): по этому номеру схема связывается с текстом.
 * Ответвления от шага — блок `alt`: первая ветка — основной путь.
 */

import { type ProcessModel, type ProcessPoint, type ProcessStepModel } from '@/data/process-model';
import type { Ledger2Operation } from '@/types/standard';
import { getWallet } from '@/data/registries';
import { roleHuman } from '@/data/labels';

const CONTRACT = 'CTR';
const LEDGER = 'LED';
const DOCS = 'DOC';
const EMBED = 'EXT';

/**
 * Другой процесс, в который шаг передаёт управление (расход участка →
 * общий процесс расходов). Его шаги встраиваются в схему блоком сразу после
 * шага; на них показываются операции этой программы, которые проводят
 * действия встроенного процесса.
 */
export interface EmbeddedProcess {
  title: string;
  contractHuman: string;
  model: ProcessModel;
  /** Операции этой программы, которые порождает действие встроенного процесса. */
  hostOps: (action: string) => Ledger2Operation[];
}

/** Mermaid ломается на `;`, `#` и переводах строки внутри подписи. */
function esc(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/#/g, '№')
    .replace(/;/g, ',')
    .trim();
}

/** Перенос длинной подписи по словам — через `<br/>`. */
function wrap(text: string, width = 44): string {
  const words = esc(text).split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > width) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.join('<br/>');
}

/** Подпись операции на схеме: название · проводка · движение по кошелькам. */
function opLabel(op: Ledger2Operation): string {
  const parts: string[] = [esc(op.human_name || op.ledger_code)];
  if (op.debit != null || op.credit != null) {
    parts.push(`Дт ${op.debit ?? '—'} / Кт ${op.credit ?? '—'}`);
  }
  if (op.wallet_op && op.wallet_op !== 'NONE' && (op.wallet_from || op.wallet_to)) {
    const f = op.wallet_from ? (getWallet(op.wallet_from)?.human_name ?? op.wallet_from) : 'извне';
    const t = op.wallet_to ? (getWallet(op.wallet_to)?.human_name ?? op.wallet_to) : 'наружу';
    parts.push(`${f} → ${t}`);
  }
  return wrap(parts.join(' · '));
}

function participantId(index: number): string {
  return `R${index}`;
}

/**
 * Куда ведёт подпись на схеме: первая строка подписи шага → шаг в описании.
 * Целью служат только шаги: щелчок по любой строке шага (операции, документу,
 * смене статуса) ведёт к шагу, а не к отдельной строке описания.
 */
export interface DiagramTarget {
  line: string;
  number: string;
  anchor: string;
  kind: 'step' | 'state' | 'op' | 'doc';
}

export interface SequenceDiagram {
  code: string;
  /** Номер точки процесса → якорь в тексте. Номер стоит в начале подписи сообщения. */
  anchors: Record<string, string>;
  /** Подписи схемы в порядке сверху вниз — для перехода к точному месту описания. */
  targets: DiagramTarget[];
}

/** Первая строка подписи в том виде, в каком mermaid выведет её текстом. */
function firstLine(label: string): string {
  return label.split('<br/>')[0].replace(/\s+/g, ' ').trim();
}

export function buildSequenceDiagram(
  model: ProcessModel,
  opts: {
    contractHuman: string;
    showLedger: boolean;
    showDocs: boolean;
    embed?: (point: ProcessPoint) => EmbeddedProcess | null;
  },
): SequenceDiagram {
  // Встроенные процессы — заранее: их участники объявляются в шапке схемы.
  const embeds = new Map<ProcessPoint, EmbeddedProcess>();
  if (opts.embed) {
    for (const st of model.steps) {
      for (const p of [st, ...st.alternatives]) {
        const e = opts.embed(p);
        if (e) embeds.set(p, e);
      }
    }
  }
  const firstEmbed = [...embeds.values()][0] ?? null;
  const embeddedActors = [...embeds.values()].flatMap((e) => e.model.actors);
  const embedHasDocs = [...embeds.values()].some((e) => e.model.documents.length > 0);
  // Документы на схеме — если они есть у самого процесса или у встроенного.
  const showDocs = opts.showDocs && (model.documents.length > 0 || embedHasDocs);

  // Роли с одинаковым названием («gateway» и «gateway_operator» — оба
  // «Кассир») — один участник схемы.
  const byLabel = new Map<string, string>();
  const actorIds = new Map<string, string>();
  for (const a of [...model.actors, ...embeddedActors]) {
    const label = a.human || a.id;
    if (!byLabel.has(label)) byLabel.set(label, participantId(byLabel.size));
    actorIds.set(a.id, byLabel.get(label)!);
  }
  const pid = (actor: string): string => actorIds.get(actor) ?? CONTRACT;

  const out: string[] = ['sequenceDiagram'];
  for (const [label, id] of byLabel) {
    out.push(`  actor ${id} as ${esc(label)}`);
  }
  out.push(`  participant ${CONTRACT} as ${esc(opts.contractHuman)}`);
  if (firstEmbed) out.push(`  participant ${EMBED} as ${esc(firstEmbed.contractHuman)}`);
  if (opts.showLedger) out.push(`  participant ${LEDGER} as Учёт: кошельки и проводки`);
  if (showDocs) out.push(`  participant ${DOCS} as Реестр документов`);

  const anchors: Record<string, string> = {};
  const targets: DiagramTarget[] = [];
  const target = (label: string, p: ProcessPoint, kind: DiagramTarget['kind'], anchor = p.anchor): string => {
    targets.push({ line: firstLine(label), number: p.number, anchor, kind });
    return label;
  };

  const emitPoint = (p: ProcessPoint, indent: string): void => {
    anchors[p.number] = p.anchor;
    const head = p.number ? `${p.number}. ` : '';
    const title = p.actionHuman && p.actionHuman !== p.title
      ? `${p.title} (${p.actionHuman})`
      : p.title;

    if (!p.action) {
      // Событие без действия контракта — заметка над ролью.
      out.push(`${indent}Note over ${pid(p.actor)}: ${target(wrap(head + title), p, 'step')}`);
      return;
    }
    out.push(`${indent}${pid(p.actor)}->>${CONTRACT}: ${target(wrap(head + title), p, 'step')}`);

    for (const c of p.changes) {
      const from = c.from === '∅' ? 'новая запись' : c.fromHuman;
      const to = c.to === '∅' ? 'запись удалена' : c.toHuman;
      out.push(`${indent}Note right of ${CONTRACT}: ${wrap(`${from} → ${to}`, 36)}`);
    }

    if (opts.showLedger) {
      for (const op of p.operations) {
        const label = opLabel(op);
        out.push(`${indent}${CONTRACT}-)${LEDGER}: ${label}`);
      }
    }

    if (showDocs) {
      p.documents.forEach((d) => {
        const signers = d.signed_by.map(roleHuman).join(', ');
        const label = wrap(`📄 ${d.title}${signers ? ` — подписывает ${signers}` : ''}`);
        out.push(`${indent}${pid(p.actor)}--)${DOCS}: ${label}`);
      });
    }
  };

  /**
   * Шаг встроенного процесса. Подпись начинается с «↳» — это не шаг этого
   * стандарта, и щелчок по ней в описание не ведёт.
   */
  const emitEmbeddedPoint = (q: ProcessPoint, e: EmbeddedProcess, indent: string): void => {
    const title = `↳ ${q.number ? `${q.number}. ` : ''}${q.title}`;
    if (!q.action) {
      out.push(`${indent}Note over ${pid(q.actor)}: ${wrap(title)}`);
      return;
    }
    out.push(`${indent}${pid(q.actor)}->>${EMBED}: ${wrap(title)}`);
    for (const c of q.changes) {
      const from = c.from === '∅' ? 'новая запись' : c.fromHuman;
      const to = c.to === '∅' ? 'запись удалена' : c.toHuman;
      out.push(`${indent}Note right of ${EMBED}: ${wrap(`${from} → ${to}`, 36)}`);
    }
    if (opts.showLedger) {
      for (const op of e.hostOps(q.action)) out.push(`${indent}${EMBED}-)${LEDGER}: ${opLabel(op)}`);
    }
    if (showDocs) {
      for (const d of q.documents) {
        const signers = d.signed_by.map(roleHuman).join(', ');
        out.push(`${indent}${pid(q.actor)}--)${DOCS}: ${wrap(`📄 ${d.title}${signers ? ` — подписывает ${signers}` : ''}`)}`);
      }
    }
  };

  const emitEmbedded = (e: EmbeddedProcess, indent: string): void => {
    out.push(`${indent}rect rgba(127, 127, 127, 0.08)`);
    out.push(`${indent}Note over ${EMBED}: ${wrap(`↳ Процесс «${e.title}»`, 36)}`);
    for (const st of e.model.steps) {
      if (st.alternatives.length === 0) {
        emitEmbeddedPoint(st, e, `${indent}`);
        continue;
      }
      out.push(`${indent}alt ${esc(`↳ шаг ${st.number}: основной путь`)}`);
      emitEmbeddedPoint(st, e, `${indent}  `);
      for (const a of st.alternatives) {
        out.push(`${indent}else ${esc(`↳ ${a.number}: ${a.title}`)}`);
        emitEmbeddedPoint(a, e, `${indent}  `);
      }
      out.push(`${indent}end`);
    }
    out.push(`${indent}end`);
  };

  const emitWithEmbed = (p: ProcessPoint, indent: string): void => {
    emitPoint(p, indent);
    const e = embeds.get(p);
    if (e) emitEmbedded(e, indent);
  };

  const emitStep = (s: ProcessStepModel): void => {
    if (s.alternatives.length === 0) {
      emitWithEmbed(s, '  ');
      return;
    }
    out.push(`  alt ${esc(`Шаг ${s.number}: основной путь`)}`);
    emitWithEmbed(s, '    ');
    for (const a of s.alternatives) {
      out.push(`  else ${esc(`${a.number}: ${a.title}`)}`);
      emitWithEmbed(a, '    ');
    }
    out.push('  end');
  };

  for (const s of model.steps) emitStep(s);

  if (model.extra.length > 0) {
    out.push(`  rect rgba(127, 127, 127, 0.08)`);
    out.push(`  Note over ${CONTRACT}: Действия вне сценария`);
    for (const p of model.extra) emitPoint(p, '  ');
    out.push('  end');
  }

  return { code: out.join('\n'), anchors, targets };
}
