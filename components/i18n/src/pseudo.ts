import type { MessageTree } from './messages';

const LATIN: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ď', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ',
  k: 'ķ', l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'ṕ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú',
  w: 'ŵ', y: 'ý', z: 'ž',
  A: 'Á', C: 'Ç', E: 'É', I: 'Í', O: 'Ö', U: 'Ú',
};

/**
 * Превращает сообщение в псевдоперевод, не трогая синтаксис vue-i18n:
 * плейсхолдеры `{name}`, литералы `{'@'}`, ссылки `@:key` и разделители
 * форм `|` остаются как есть. Каждая форма обрамляется `[!! … !!]`
 * и удлиняется примерно на треть — так видно тесную вёрстку.
 */
export function pseudoMessage(message: string): string {
  return message
    .split(/(?<!\\)\|/)
    .map((form) => {
      let out = '';
      let letters = 0;
      let i = 0;
      while (i < form.length) {
        const ch = form[i];
        if (ch === '{') {
          const end = form.indexOf('}', i);
          const stop = end === -1 ? form.length : end + 1;
          out += form.slice(i, stop);
          i = stop;
          continue;
        }
        if (ch === '@' && /^@(\.\w+)?:/.test(form.slice(i))) {
          const match = /^@(\.\w+)?:(\([^)]*\)|[\w.\-]+)/.exec(form.slice(i));
          const token = match ? match[0] : '@';
          out += token;
          i += token.length;
          continue;
        }
        if (/\p{L}/u.test(ch)) letters++;
        out += LATIN[ch] ?? ch;
        i++;
      }
      const lead = form.match(/^\s*/)?.[0] ?? '';
      const trail = form.match(/\s*$/)?.[0] ?? '';
      const body = out.trim();
      const pad = '·'.repeat(Math.ceil(letters * 0.3));
      return `${lead}[!! ${body}${pad ? ' ' + pad : ''} !!]${trail}`;
    })
    .join('|');
}

export function pseudoLocalize(tree: MessageTree): MessageTree {
  const out: MessageTree = {};
  for (const [key, value] of Object.entries(tree)) {
    out[key] = typeof value === 'string' ? pseudoMessage(value) : pseudoLocalize(value);
  }
  return out;
}
