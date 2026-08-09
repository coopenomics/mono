// Загрузка и валидация реестра тестов (test-registry/*.yaml).
//
// Реестр отвечает на вопрос «что у нас есть по фиче, а чего нет» и служит
// опорой для гейта: тронул код фичи — обнови её файл в реестре.
//
// Схема намеренно плоская и скучная: чем меньше в ней выразительности,
// тем труднее ей соврать.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import YAML from 'yaml';

export const LEVELS = ['contract', 'backend', 'ui'];
export const KINDS = ['happy', 'side', 'break'];
export const STATUSES = ['missing', 'written', 'passing'];

// Области кода, изменение которых обязано быть отражено в реестре.
// Всё остальное (конфиги, скрипты, вёрстка витрин) гейт не трогает.
export const SIGNIFICANT_ROOTS = [
  'components/controller/src/extensions/',
  'components/controller/src/domain/',
  'components/desktop/extensions/',
  'components/contracts/cpp/',
  // UI Стола заказов лежит НЕ в desktop/extensions (там всего 3 файла
  // установщика), а в ядре desktop — 45 страниц плюс виджеты, фичи и
  // сущности. Без этих корней гейт не замечал правок интерфейса
  // маркетплейса вообще. Корни намеренно без завершающего слэша: остаток
  // пути тогда начинается с «/», и область в аудите получается одна на
  // пространство имён, а не по строке на каждую страницу.
  'components/desktop/src/pages/Marketplace',
  'components/desktop/src/widgets/Marketplace',
  'components/desktop/src/features/Marketplace',
  'components/desktop/src/entities/Marketplace',
];

const FEATURE_RE = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

/** glob → RegExp. Поддерживаются `**` (любая глубина) и `*` (в пределах сегмента). */
export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        out += '[^/]*';
      }
    } else if ('\\^$+?.()|{}[]'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

export function loadRegistry(repoRoot) {
  const dir = join(repoRoot, 'test-registry');
  const errors = [];
  const features = [];

  if (!existsSync(dir)) return { features, errors };

  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') && !f.startsWith('_'));
  const seenIds = new Map();

  for (const file of files) {
    const path = join(dir, file);
    const rel = `test-registry/${file}`;
    let doc;
    try {
      doc = YAML.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push(`${rel}: не разобрался как YAML — ${e.message}`);
      continue;
    }
    if (!doc || typeof doc !== 'object') {
      errors.push(`${rel}: пустой или не объект`);
      continue;
    }

    const { feature, title, sources, cases } = doc;

    if (!feature || !FEATURE_RE.test(feature)) {
      errors.push(`${rel}: feature='${feature}' — ожидается вид <домен>.<фича>, строчными`);
    } else if (basename(file, '.yaml') !== feature) {
      errors.push(`${rel}: имя файла должно совпадать с feature ('${feature}.yaml')`);
    }
    if (!title) errors.push(`${rel}: нет title`);

    const srcGlobs = [];
    for (const [level, globs] of Object.entries(sources ?? {})) {
      if (!LEVELS.includes(level)) {
        errors.push(`${rel}: sources.${level} — уровень не из ${LEVELS.join('|')}`);
        continue;
      }
      for (const g of [].concat(globs ?? [])) srcGlobs.push({ level, glob: g, re: globToRegExp(g) });
    }
    if (srcGlobs.length === 0) errors.push(`${rel}: нет ни одного sources.<уровень> — гейт не сможет связать код с фичей`);

    const list = [];
    for (const [i, c] of (cases ?? []).entries()) {
      const where = `${rel} cases[${i}]`;
      if (!c?.id) errors.push(`${where}: нет id`);
      else if (seenIds.has(c.id)) errors.push(`${where}: id '${c.id}' уже занят в ${seenIds.get(c.id)}`);
      else seenIds.set(c.id, rel);

      if (!LEVELS.includes(c?.level)) errors.push(`${where}: level='${c?.level}' — не из ${LEVELS.join('|')}`);
      if (!KINDS.includes(c?.kind)) errors.push(`${where}: kind='${c?.kind}' — не из ${KINDS.join('|')}`);
      if (!STATUSES.includes(c?.status)) errors.push(`${where}: status='${c?.status}' — не из ${STATUSES.join('|')}`);
      if (!c?.scenario) errors.push(`${where}: нет scenario`);
      if (!c?.expect) errors.push(`${where}: нет expect`);

      const hasTest = !!c?.test;
      if (c?.status === 'missing' && hasTest) {
        errors.push(`${where}: status=missing, но указан test — статус не соответствует`);
      }
      if (c?.status !== 'missing') {
        if (!hasTest) errors.push(`${where}: status=${c?.status} требует ссылки на тест в поле test`);
        else if (!existsSync(join(repoRoot, c.test))) errors.push(`${where}: тест '${c.test}' не существует`);
      }
      list.push({ ...c, __file: rel });
    }

    features.push({ feature, title, file: rel, sources: srcGlobs, cases: list });
  }

  return { features, errors };
}

/** Все фичи реестра, чьи sources-globs покрывают данный путь. */
export function featuresForPath(features, path) {
  return features.filter((f) => f.sources.some((s) => s.re.test(path)));
}

export function isSignificant(path) {
  return SIGNIFICANT_ROOTS.some((root) => path.startsWith(root));
}
