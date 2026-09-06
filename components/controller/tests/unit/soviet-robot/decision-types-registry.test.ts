/**
 * Гейт единственного реестра решений совета.
 *
 * Список автоматизируемых решений живёт в одном файле — `decisionTypesRegistry`
 * пакета cooptypes. Файл легко забыть: повестку заводит контракт, а реестр
 * лежит в TypeScript, и рассинхрон никак себя не проявляет — решение просто
 * молча не показывается в столе робота либо, наоборот, показывается там, где
 * его не бывает.
 *
 * Поэтому реестр сверяется с исходниками контрактов: тест сам вычитывает все
 * вызовы повестки (`soviet::createagenda`) и падает, когда появился тип, не
 * описанный ни в реестре, ни в списке неавтоматизируемых ниже.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Cooperative } from 'cooptypes';

const CONTRACTS_DIR = path.resolve(__dirname, '../../../../contracts/cpp');

/**
 * Повестки, которые контракт заводит, но робот автоматизировать не может, —
 * с причиной. Появился шаблон протокола — тип переезжает в реестр, строка
 * отсюда убирается.
 */
const NOT_AUTOMATABLE: Record<string, string> = {
  createexp: 'служебная записка-смета о расходах: шаблон протокола не описан',
  ledgerwthd: 'списание со счёта через реестр проводок: шаблон протокола не описан',
  capresexpns: 'выплата по расходам задания: шаблон протокола не описан',
  capwthdrprog: 'возврат членских взносов по программе: шаблон протокола не описан',
  createdebt: 'ссуда под будущее задание: шаблон протокола не описан',
  createprj: 'повестка проекта Благороста: имени нет даже в soviet_actions контракта',
  createpgprp: 'повестка программного имущественного взноса: имени нет даже в soviet_actions',
};

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.(cpp|hpp)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Именованные константы контрактов: `constexpr eosio::name X = "value"_n`. */
function nameConstants(files: string[]): Map<string, string> {
  const table = new Map<string, string>();
  const declaration = /(?:constexpr|const)\s+eosio::name\s+(\w+)\s*=\s*"([a-z1-5.]*)"_n/g;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf-8');
    for (const match of text.matchAll(declaration)) table.set(match[1], match[2]);
  }
  return table;
}

/** Аргументы вызова, начиная с открывающей скобки: разбор по верхнему уровню. */
function callArguments(text: string, openParen: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = openParen; i < text.length; i++) {
    const char = text[i];
    if (char === '(') {
      depth++;
      if (depth === 1) continue;
    }
    if (char === ')') {
      depth--;
      if (depth === 0) {
        args.push(current);
        return args;
      }
    }
    if (char === ',' && depth === 1) {
      args.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  return args;
}

/** Имя типа из выражения аргумента: литерал, обёртка проверки или константа. */
function resolveType(expression: string, constants: Map<string, string>): string | null {
  const cleaned = expression.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  const literal = cleaned.match(/"([a-z1-5.]+)"_n/);
  if (literal) return literal[1];
  const identifier = cleaned.match(/([A-Za-z_]\w*)\s*\)?$/);
  if (!identifier) return null;
  return constants.get(identifier[1]) ?? null;
}

/** Типы повесток, которые контракты заводят на самом деле. */
function agendaTypesFromContracts(): Map<string, string[]> {
  const files = sources(CONTRACTS_DIR);
  const constants = nameConstants(files);
  const found = new Map<string, string[]>();

  const remember = (type: string | null, file: string) => {
    if (!type) return;
    const places = found.get(type) ?? [];
    places.push(path.relative(CONTRACTS_DIR, file));
    found.set(type, places);
  };

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf-8');
    // Хелпер: create_agenda(calling_contract, coopname, username, type, ...)
    for (const match of text.matchAll(/create_agenda\s*\(/g)) {
      const open = match.index! + match[0].length - 1;
      const args = callArguments(text, open);
      if (args.length > 3) remember(resolveType(args[3], constants), file);
    }
    // Прямой вызов: action(..., "createagenda"_n, std::make_tuple(coopname, username, type, ...))
    for (const match of text.matchAll(/"createagenda"_n[\s\S]{0,120}?make_tuple\s*\(/g)) {
      const open = match.index! + match[0].length - 1;
      const args = callArguments(text, open);
      if (args.length > 2) remember(resolveType(args[2], constants), file);
    }
  }
  return found;
}

/** Имена, объявленные в контракте как допустимые для реестра документов совета. */
function sovietActions(): string[] {
  const text = fs.readFileSync(path.join(CONTRACTS_DIR, 'lib/consts.hpp'), 'utf-8');
  const block = text.match(/soviet_actions\s*=\s*\{([\s\S]*?)\};/);
  if (!block) throw new Error('В lib/consts.hpp не найден набор soviet_actions');
  return [...block[1].matchAll(/"([a-z1-5.]+)"_n/g)].map((match) => match[1]);
}

describe('Реестр решений совета сверен с контрактами', () => {
  const registry = Cooperative.Document.decisionTypesRegistry;
  const agenda = agendaTypesFromContracts();

  it('контракты вообще разобраны: повестки найдены', () => {
    expect(agenda.size).toBeGreaterThan(5);
  });

  it('каждое решение реестра контракт действительно выносит на голосование', () => {
    const missing = Object.keys(registry).filter((type) => !agenda.has(type));
    expect(missing).toEqual([]);
  });

  it('каждая повестка контракта либо в реестре, либо объявлена неавтоматизируемой', () => {
    const unknown = [...agenda.keys()].filter((type) => !(type in registry) && !(type in NOT_AUTOMATABLE));
    expect(unknown).toEqual([]);
  });

  it('список неавтоматизируемых не протух: каждая строка про живую повестку', () => {
    const stale = Object.keys(NOT_AUTOMATABLE).filter((type) => !agenda.has(type) || type in registry);
    expect(stale).toEqual([]);
  });

  it('типы реестра объявлены в soviet_actions контракта', () => {
    const declared = new Set(sovietActions());
    const undeclaredTypes = Object.keys(registry).filter((type) => !declared.has(type));
    expect(undeclaredTypes).toEqual([]);
  });

  it('у каждого решения есть шаблон протокола из реестра документов', () => {
    const known = new Set(
      Object.values(Cooperative.Registry as Record<string, { registry_id?: number }>)
        .map((document) => document?.registry_id)
        .filter((id): id is number => typeof id === 'number')
    );
    const broken = Object.values(registry).filter((info) => !known.has(info.protocol_registry_id));
    expect(broken).toEqual([]);
  });

  it('расширение-владелец указано именем из реестра расширений платформы', () => {
    const allowed = new Set(['capital', 'market', 'trustee']);
    const wrong = Object.values(registry).filter((info) => info.extension !== null && !allowed.has(info.extension));
    expect(wrong).toEqual([]);
  });
});
