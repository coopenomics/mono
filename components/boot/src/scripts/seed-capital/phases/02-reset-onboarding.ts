/**
 * Фаза 02-reset-onboarding — обнуляет флаги адаптации Capital extension.
 *
 * `bootExtra()` через `initExtensionsInPostgres` ставит все
 * `onboarding_*_done=true` как dev-shortcut, и UI считает онбординг
 * председателя завершённым (CapitalOnboardingCard прячется, председателя
 * сразу пускают в Мастерскую). Для скриншотов адаптации нам нужно
 * противоположное состояние: запись существует, но все 5 шагов в pending.
 *
 * Эта фаза делает UPDATE на существующей записи `extensions.capital`,
 * выставляя все 5 `onboarding_*_done` в false и удаляя все 5
 * `onboarding_*_hash` ключей. Логика UI на этих полях:
 *   *_done=true                 → completed (зелёная галка)
 *   *_done=false, *_hash≠null   → in_progress («Ожидаем решение совета»)
 *   *_done=false, *_hash=null   → pending (кнопка «Объявить собрание совета»)
 * Нам нужен последний — поэтому обнуляем оба.
 *
 * Идемпотентно.
 */
import { Client } from 'pg'

const log = (...a: unknown[]) => console.error('[seed-capital:02-reset]', ...a)

export async function phase02Reset(): Promise<void> {
  const pg = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })
  await pg.connect()
  try {
    log('сбрасываю onboarding_*_done=false и удаляю onboarding_*_hash в extensions.capital.config')
    const result = await pg.query(`
      UPDATE "extensions"
      SET config = (config
        || jsonb_build_object(
          'onboarding_generator_program_template_done', false,
          'onboarding_generation_contract_template_done', false,
          'onboarding_generator_offer_template_done', false,
          'onboarding_blagorost_provision_done', false,
          'onboarding_blagorost_offer_template_done', false
        ))
        - 'onboarding_generator_program_template_hash'
        - 'onboarding_generation_contract_template_hash'
        - 'onboarding_generator_offer_template_hash'
        - 'onboarding_blagorost_provision_hash'
        - 'onboarding_blagorost_offer_template_hash',
        updated_at = CURRENT_TIMESTAMP
      WHERE name = 'capital'
    `)
    log(`обновлено строк: ${result.rowCount}`)
    if (result.rowCount === 0) {
      log('запись extensions.capital отсутствует — сначала запусти 02-extension-config')
    }
  } finally {
    await pg.end()
  }
}
