/**
 * Очистка текста, который человек пишет в редакторе: описание проекта или
 * задачи, приглашение, краткое содержание звонка.
 *
 * Живёт в общем пакете, потому что нужна с двух сторон сразу. В редакторе она
 * стояла с самого начала, а мутация принимала что угодно: запрос напрямую в
 * API (или из blago-cli) клал в базу произвольную разметку, и она потом
 * попадала в собираемые документы мимо всякой очистки.
 *
 * Правило намеренно мягкое — это не белый список: описание живёт вперемешку с
 * разметкой, таблицами и схемами, и вырезать их значило бы испортить уже
 * написанное. Убирается только исполняемое: скрипты и стили, встраиваемые
 * рамки и объекты, обработчики событий, ссылки со схемами javascript/vbscript
 * и data:text/html. Содержимое блоков кода (``` и ~~~) не трогается вовсе —
 * там примеры, введённые как есть.
 */

const FENCE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;

function stripDangerousTags(text: string): string {
  let s = text;
  for (let i = 0; i < 6; i++) {
    const next = s
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '');
    if (next === s) break;
    s = next;
  }
  s = s.replace(/<\/script>/gi, '');
  s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
  s = s.replace(/<object\b[\s\S]*?<\/object>/gi, '');
  s = s.replace(/<embed\b[^>]*>/gi, '');
  s = s.replace(/<link\b[^>]*>/gi, '');
  s = s.replace(/<meta\b[^>]*>/gi, '');
  s = s.replace(/<base\b[^>]*>/gi, '');
  return s;
}

function stripMarkdownLinkSchemes(text: string): string {
  return text
    .replace(/\]\(\s*javascript:/gi, '](unsafe:')
    .replace(/\]\(\s*vbscript:/gi, '](unsafe:')
    .replace(/\]\(\s*data:text\/html/gi, '](unsafe:')
    .replace(/<(javascript:[^>\s]*)>/gi, '&lt;$1&gt;')
    .replace(/<(vbscript:[^>\s]*)>/gi, '&lt;$1&gt;');
}

/** Убирает on*=, javascript:/vbscript:/data: в href/src/srcset */
function stripUnsafeInlineHtmlAttributes(text: string): string {
  return text.replace(
    /<([a-zA-Z][\w:-]*)((?:\s+[^>\s/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?)*)(\s*\/?>)/g,
    (_full, tag: string, attrs: string, closing: string) => {
      if (!attrs || !attrs.trim()) {
        return `<${tag}${closing}`;
      }
      const a = attrs
        .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s+href\s*=\s*("[']?)\s*javascript:/gi, ' href=$1unsafe:')
        .replace(/\s+href\s*=\s*("[']?)\s*vbscript:/gi, ' href=$1unsafe:')
        .replace(/\s+href\s*=\s*("[']?)\s*data:text\/html/gi, ' href=$1unsafe:')
        .replace(/\s+src\s*=\s*("[']?)\s*javascript:/gi, ' src=$1unsafe:')
        .replace(/\s+src\s*=\s*("[']?)\s*vbscript:/gi, ' src=$1unsafe:')
        .replace(/\s+src\s*=\s*("[']?)\s*data:text\/html/gi, ' src=$1unsafe:')
        .replace(/\s+srcset\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (srcset) => {
          if (/javascript:|vbscript:|data:text\/html/i.test(srcset)) {
            return ' srcset=""';
          }
          return srcset;
        });
      return `<${tag}${a}${closing}`;
    },
  );
}

function sanitizeProseChunk(chunk: string): string {
  if (!chunk) return chunk;
  let s = stripDangerousTags(chunk);
  s = stripMarkdownLinkSchemes(s);
  if (/<[a-zA-Z!?/]/.test(s)) {
    s = stripUnsafeInlineHtmlAttributes(s);
  }
  return s;
}

export function sanitizeEditorMarkdown(md: string): string {
  if (!md) return md;
  const out: string[] = [];
  let last = 0;
  const re = new RegExp(FENCE_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    out.push(sanitizeProseChunk(md.slice(last, m.index)));
    out.push(m[0]);
    last = m.index + m[0].length;
  }
  out.push(sanitizeProseChunk(md.slice(last)));
  return out.join('');
}
