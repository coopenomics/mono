/**
 * Фаза 02 — наличие записи `extensions.capital` в PostgreSQL controller'а.
 *
 * Controller хранит state онбординга в таблице `extensions` (запись с `name='capital'`).
 * UI запрашивает его через `Queries.Capital.GetOnboardingState`. Если записи нет —
 * controller возвращает 500 и UI default'ом показывает страницу адаптации, любой URL
 * под `/capital/*` редиректит туда.
 *
 * В dev-конфигурации существует shortcut: запись создаётся со всеми `*_done=true` и
 * предзаполненными `*_hash` — UI считает онбординг пройденным и сразу пускает в
 * Мастерскую. Этот shortcut живёт в `boot/src/postgres-init.ts:initExtensionsInPostgres`,
 * вызывается из `bootExtra()`. Если по какой-то причине запись отсутствует (другая БД,
 * был сброс postgres volumes между прогонами и т.п.) — здесь восстанавливаем.
 *
 * Идемпотентно: `initExtensionsInPostgres` использует `INSERT ... ON CONFLICT DO UPDATE`,
 * повторный прогон обновляет updated_at и не дублирует.
 *
 * РЕАЛЬНОЕ проведение онбординга через совет (фабричный документ → propose → vote × 3 →
 * authorize → exec) зарезервировано в `02b-real-onboarding.ts` и нужно отдельно, когда
 * мы будем документировать сам процесс адаптации в UI.
 */
import { initExtensionsInPostgres } from '../../../postgres-init'

const log = (...a: unknown[]) => console.error('[seed-capital:02]', ...a)

export async function phase02(): Promise<void> {
  log('инициализирую extensions.capital в postgres (dev-shortcut: все *_done=true)')
  await initExtensionsInPostgres()
  log('фаза 02 завершена')
}
