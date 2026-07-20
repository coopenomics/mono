'use strict';

/**
 * Генерация Zeus-клиента в @coopenomics/sdk и копирование shared-типов контроллера.
 *
 * graphql-zeus 7.x: в CLIClass `pathToFile = args._[1]`, а yargs кладёт позиционные в `path` / `output_path`,
 * не в `args._` → второй аргумент игнорируется, вывод всегда в `<cwd>/zeus`. Поэтому cwd = controller,
 * затем копируем `controller/zeus` → `sdk/src/zeus`.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const controllerRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(controllerRoot, 'schema.gql');
const zeusConfigPath = path.join(controllerRoot, 'graphql-zeus.json');
const sdkSrc = path.resolve(controllerRoot, '..', 'sdk', 'src');
const localZeusDir = path.join(controllerRoot, 'zeus');
const sdkZeusDir = path.join(sdkSrc, 'zeus');
const sdkZeusIndex = path.join(sdkZeusDir, 'index.ts');
const sharedDir = path.join(controllerRoot, 'src', 'types', 'shared');
const controllerTypesDest = path.join(sdkSrc, 'types', 'controller');

function resolveZeusBin() {
  const isWin = process.platform === 'win32';
  const bin = path.join(controllerRoot, 'node_modules', '.bin', isWin ? 'zeus.cmd' : 'zeus');
  if (!fs.existsSync(bin)) {
    throw new Error(`Не найден zeus в ${bin} (pnpm install в controller).`);
  }
  return { bin, isWin };
}

if (!fs.existsSync(schemaPath)) {
  console.error(`generate-client: нет ${schemaPath}. Сначала выполните generate-schema.`);
  process.exit(1);
}

if (!fs.existsSync(sdkSrc)) {
  console.error(`generate-client: нет каталога SDK: ${sdkSrc}`);
  process.exit(1);
}

// graphql-zeus 7.x: yargs кладёт path в argv.path, а CLIClass читает args._[0].
// Без graphql-zeus.json config-maker уходит в inquirer и «зависает» без TTY.
if (!fs.existsSync(zeusConfigPath)) {
  fs.writeFileSync(zeusConfigPath, `${JSON.stringify({ urlOrPath: './schema.gql' }, null, 2)}\n`, 'utf8');
}

let zeusBin;
let zeusIsWin;
try {
  ({ bin: zeusBin, isWin: zeusIsWin } = resolveZeusBin());
} catch (e) {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}

const zeusArgs = ['./schema.gql', '../sdk/src', '--subscriptions', 'graphql-ws'];
const startedAt = Date.now();
console.log('generate-client: graphql-zeus… (5–30 с без вывода — норма, не прерывайте)');
const result = spawnSync(zeusBin, zeusArgs, {
  stdio: 'inherit',
  cwd: controllerRoot,
  env: process.env,
  shell: zeusIsWin,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status === null ? 1 : result.status);
}

if (!fs.existsSync(path.join(localZeusDir, 'index.ts'))) {
  console.error(`generate-client: Zeus не создал ${localZeusDir}`);
  process.exit(1);
}

fs.rmSync(sdkZeusDir, { recursive: true, force: true });
fs.cpSync(localZeusDir, sdkZeusDir, { recursive: true });

const zeusMtime = fs.statSync(sdkZeusIndex).mtimeMs;
if (zeusMtime < startedAt - 2000) {
  console.error('generate-client: копирование zeus в SDK не обновило index.ts.');
  process.exit(1);
}

if (!fs.existsSync(sharedDir)) {
  console.warn(`generate-client: нет ${sharedDir}, копирование типов пропущено.`);
  process.exit(0);
}

fs.mkdirSync(controllerTypesDest, { recursive: true });
for (const name of fs.readdirSync(sharedDir)) {
  const from = path.join(sharedDir, name);
  const to = path.join(controllerTypesDest, name);
  fs.cpSync(from, to, { recursive: true });
}

console.log(`generate-client: zeus → ${path.join(sdkSrc, 'zeus')}, типы → ${controllerTypesDest}`);
