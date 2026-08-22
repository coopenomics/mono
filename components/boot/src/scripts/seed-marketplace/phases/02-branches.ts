/**
 * Фаза 02 — кооперативные участки Подмосковья (krg / odn / myt).
 *
 * Зачем отдельной фазой. `reboot:extra` засевает только строки
 * `marketplace_ku_details` в PostgreSQL, а сами участки в core-реестре
 * (branch::createbranch) не создаёт. Строки без участка осиротевшие: на
 * странице подключения заказчика пункты выдачи показываются безымянными
 * («Кооперативный участок» вместо «Красногорск»), потому что человеческое имя
 * и реквизиты берутся из core-реестра, а в деталях ПВЗ их нет вовсе.
 *
 * Фаза переиспользует существующий скрипт seed-marketplace-branches.ts: он
 * заводит аккаунты участков, создаёт ветки с председателями и добавляет
 * доверенное лицо Красногорска. Скрипт самодостаточен и идемпотентен, поэтому
 * запускаем его как есть — дублировать логику ради «красивого импорта» хуже,
 * чем один spawn.
 *
 * Председатели участков (chairkrg/chairodn/chairmyt) должны существовать как
 * пайщики: их создаёт harness через lib/fixtures.mjs. Если аккаунта нет,
 * скрипт сообщит об этом сам — молча пропускать участок нельзя, иначе
 * получится тот же безымянный список.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const log = (...a: unknown[]) => console.error('[seed-marketplace:02]', ...a)

const BOOT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

export async function phase02(): Promise<void> {
  log('создаю кооперативные участки krg/odn/myt (branch::createbranch)')
  const r = spawnSync('npx', ['esno', 'src/scripts/seed-marketplace-branches.ts'], {
    cwd: BOOT_ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) throw new Error('seed-marketplace-branches завершился с ошибкой')
}
