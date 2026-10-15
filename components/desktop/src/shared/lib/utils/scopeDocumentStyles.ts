/**
 * Стили документа — только для этого документа.
 *
 * Шаблон приносит свой `<style>` с правилами вида `.digital-document p { … }`
 * или просто `h1 { … }`. Вставленный на страницу, такой тег действует на всю
 * страницу: два документа на одном экране начинают перекрашивать друг друга.
 * Так было на подключении ЦПП: `text-align: justify` из договора ложился на
 * абзацы положения, и шапка «УТВЕРЖДЕНО» уезжала из правого угла влево.
 *
 * Каждое правило получает префикс контейнера документа (`[data-doc-scope]`),
 * и стиль дальше своего документа не выходит. Обычная обработка строки — она
 * работает и при серверной отрисовке. `@media`/`@supports` разбираются внутрь,
 * прочие @-правила (`@page`, `@font-face`, `@keyframes`) оставляются как есть:
 * к элементам страницы они не привязаны.
 */
export function scopeDocumentStyles(html: string, scope: string): string {
  if (!html || !html.includes('<style')) return html;
  const prefix = `[data-doc-scope="${scope}"]`;
  return html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open: string, css: string, close: string) => `${open}${scopeCss(css, prefix)}${close}`);
}

/** Переписать правила CSS с префиксом области. */
export function scopeCss(css: string, prefix: string): string {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf('{', i);
    if (open === -1) {
      out += source.slice(i);
      break;
    }
    const head = source.slice(i, open);
    const close = matchingBrace(source, open);
    const body = source.slice(open + 1, close);
    const selector = head.trim();
    if (/^@(media|supports|container|layer)\b/i.test(selector)) {
      out += `${head}{${scopeCss(body, prefix)}}`;
    } else if (selector.startsWith('@')) {
      out += `${head}{${body}}`;
    } else {
      out += `${scopeSelectorList(selector, prefix)}{${body}}`;
    }
    i = close + 1;
  }
  return out;
}

function matchingBrace(source: string, open: number): number {
  let depth = 0;
  for (let j = open; j < source.length; j++) {
    if (source[j] === '{') depth++;
    else if (source[j] === '}') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return source.length - 1;
}

/** Список селекторов через запятую; запятые внутри `:is(…)`/`:not(…)` не делят. */
function scopeSelectorList(list: string, prefix: string): string {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let j = 0; j < list.length; j++) {
    const ch = list[j];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(list.slice(start, j));
      start = j + 1;
    }
  }
  parts.push(list.slice(start));
  return parts.map((part) => scopeSelector(part.trim(), prefix)).join(', ');
}

// Корень документа (`html`, `body`, `:root`) — это сам контейнер документа.
function scopeSelector(selector: string, prefix: string): string {
  if (!selector) return selector;
  const root = selector.match(/^(html|body|:root)\b\s*/i);
  if (root) {
    const rest = selector.slice(root[0].length);
    return rest ? `${prefix} ${rest}` : prefix;
  }
  return `${prefix} ${selector}`;
}
