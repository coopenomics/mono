/**
 * Контракт портов `@coopenomics/innercoop` (DEC-018): у каждого объявленного
 * порта есть реализация, и объявлена она там, где положено по направлению
 * связи.
 *
 * Порт без реализации компилируется молча: расширение получит ошибку DI только
 * в рантайме и только если до этого места дойдёт исполнение. Проверка дешёвая,
 * а пропущенный биндинг — самая частая ошибка при заведении нового порта.
 *
 * Направления:
 *   core-ports         — реализует ядро, потребляют расширения;
 *   cross-plugin-ports — реализует расширение, потребляют другие;
 *   hooks              — реализует расширение, вызывает ядро.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '../../..', '..');
const PORTS_SRC = join(REPO_ROOT, 'innercoop/src');
const CONTROLLER_SRC = join(__dirname, '../../..', 'src');

/** Все файлы .ts контроллера — по ним ищем места привязки. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Токены секции: имя константы и строка символа. */
function tokensOf(section: string): Array<{ name: string; symbol: string; file: string }> {
  const dir = join(PORTS_SRC, section);
  const tokens: Array<{ name: string; symbol: string; file: string }> = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
    const source = readFileSync(join(dir, file), 'utf8');
    for (const match of source.matchAll(/export const (\w+) = Symbol\.for\('([^']+)'\)/g)) {
      tokens.push({ name: match[1], symbol: match[2], file: `${section}/${file}` });
    }
  }
  return tokens;
}

const controllerFiles = walk(CONTROLLER_SRC).filter((f) => !/\.(spec|test)\.ts$/.test(f));

/** Где токен привязывается к реализации: файлы с `provide: <TOKEN>`. */
function bindingsOf(token: string): string[] {
  const pattern = new RegExp(`provide:\\s*${token}\\b`);
  return controllerFiles
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(CONTROLLER_SRC.length + 1));
}

/**
 * Кто владеет реализацией порта — ядро или расширение.
 *
 * По месту биндинга это не определить: мост привязывает обе стороны, он для
 * того и заведён. Определяет класс-адаптер — где объявлен он, там и владелец.
 */
function ownerOf(token: string): 'core' | 'extension' | 'unknown' {
  const bindingPattern = new RegExp(`provide:\\s*${token}\\s*,\\s*use(?:Existing|Class)\\s*:\\s*(\\w+)`, 's');

  for (const file of controllerFiles) {
    const match = readFileSync(file, 'utf8').match(bindingPattern);
    if (!match) continue;

    const adapter = match[1];
    const declaration = new RegExp(`export class ${adapter}\\b`);
    const home = controllerFiles.find((candidate) => declaration.test(readFileSync(candidate, 'utf8')));
    if (!home) continue;

    return home.slice(CONTROLLER_SRC.length + 1).startsWith('extensions/') ? 'extension' : 'core';
  }
  return 'unknown';
}

const CORE_PORTS = tokensOf('core-ports');
const CROSS_PLUGIN_PORTS = tokensOf('cross-plugin-ports');
const HOOKS = tokensOf('hooks');

describe('Каждый порт имеет реализацию', () => {
  it.each(CORE_PORTS.map((t) => [t.name, t]))('%s', (_name, token) => {
    expect(bindingsOf((token as { name: string }).name).length).toBeGreaterThan(0);
  });

  it.each(CROSS_PLUGIN_PORTS.map((t) => [t.name, t]))('%s', (_name, token) => {
    expect(bindingsOf((token as { name: string }).name).length).toBeGreaterThan(0);
  });

  it.each(HOOKS.map((t) => [t.name, t]))('%s', (_name, token) => {
    expect(bindingsOf((token as { name: string }).name).length).toBeGreaterThan(0);
  });
});

describe('Реализация объявлена по направлению связи', () => {
  it('порт ядра реализуется ядром', () => {
    const wrong = CORE_PORTS.map((token) => ({ token: token.name, owner: ownerOf(token.name) })).filter(
      (row) => row.owner === 'extension'
    );

    expect(wrong).toEqual([]);
  });

  it('межрасширенческий порт реализуется расширением', () => {
    const wrong = CROSS_PLUGIN_PORTS.map((token) => ({
      token: token.name,
      owner: ownerOf(token.name),
    })).filter((row) => row.owner === 'core');

    expect(wrong).toEqual([]);
  });
});

describe('Токены различимы', () => {
  it('строка символа уникальна: две одинаковые молча слились бы в один провайдер', () => {
    const all = [...CORE_PORTS, ...CROSS_PLUGIN_PORTS, ...HOOKS];
    const bySymbol = new Map<string, string[]>();
    for (const token of all) {
      bySymbol.set(token.symbol, [...(bySymbol.get(token.symbol) ?? []), token.name]);
    }

    const collisions = [...bySymbol.entries()].filter(([, names]) => names.length > 1);
    expect(collisions).toEqual([]);
  });

  it('имя символа отражает владельца реализации, а не каталог', () => {
    // Каталог группирует порты по теме, и один файл может держать обе стороны
    // связи: «права пайщика на столе» — это и хук расширения, и реестр, куда
    // расширение себя кладёт, а реестром владеет ядро. Поэтому сверяемся с
    // фактическим местом привязки, а не с каталогом.
    const wrong = [...CORE_PORTS, ...CROSS_PLUGIN_PORTS, ...HOOKS]
      .map((token) => {
        const owner = ownerOf(token.name);
        if (owner === 'unknown') return null;

        const ok =
          owner === 'core'
            ? token.symbol.startsWith('Innercoop.CorePort.')
            : /^Innercoop\.(CrossPlugin|Hook)\./.test(token.symbol);
        return ok
          ? null
          : `${token.file}: ${token.name} = ${token.symbol} (реализует ${owner === 'core' ? 'ядро' : 'расширение'})`;
      })
      .filter(Boolean);

    expect(wrong).toEqual([]);
  });
});

describe('Контракт остаётся строгим', () => {
  /**
   * Голый `any` в контракте — отказ от типа там, где тип и есть весь смысл:
   * расширение сверяется с портом, не видя реализации.
   *
   * Открытые формы — `[key: string]: any`, `Record<string, any>`, `<T = any>` —
   * разрешены осознанно. Это данные, чей состав задаёт не контракт портов, а
   * ABI блокчейна, документ или внешний платёжный провайдер; перечислять их
   * поля здесь значило бы вести вторую копию чужой схемы, которая разойдётся с
   * первой. Тип у них ровно такой, какой есть: «объект произвольного состава».
   */
  it.each(['core-ports', 'cross-plugin-ports', 'hooks'])('в %s нет голого any', (section) => {
    const dir = join(PORTS_SRC, section);
    const found: string[] = [];

    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const lines = readFileSync(join(dir, file), 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (!/\bany\b/.test(line)) return;
        if (/\[key: string\]:\s*any/.test(line)) return;
        // Открытая форма объекта и дженерик по умолчанию — см. комментарий выше.
        if (/Record<string,\s*any>/.test(line)) return;
        if (/<T\s*=\s*any>/.test(line)) return;
        // Конструктор класса в типе сущности: параметры чужие, их не описать.
        if (/new \(\.\.\.args: any\[\]\)/.test(line)) return;
        // Строка комментария про any — не объявление.
        if (/^\s*(\*|\/\/)/.test(line)) return;
        found.push(`${section}/${file}:${index + 1}  ${line.trim()}`);
      });
    }

    expect(found).toEqual([]);
  });
});
