/**
 * CLI-диспетчер seed-фаз эмиссии L3 кошельков marketplace-фикстур.
 *
 *   pnpm --filter @coopenomics/boot exec esno \
 *     src/scripts/seed-marketplace-deposits/index.ts <phase>
 *
 * Используется в harness через meta.prepare = ['marketplace-deposits:fund'].
 *
 * Фазы:
 *   - fund — wallet::createdeposit + gateway::completeincome для ekaterina и
 *     ivanpetrov; восстанавливает баланс Main Wallet для magistral II.
 *
 * Каждая фаза идемпотентна по failure semantics (ошибка остановит цепь). По
 * созданию — каждый запуск добавляет ещё одну эмиссию (баланс растёт), что
 * безопасно для dev-стенда.
 */
import { fund } from './fund'

const log = (...a: unknown[]) => console.error('[seed-marketplace-deposits]', ...a)

const phaseMap: Record<string, () => Promise<void>> = {
  fund,
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: seed-marketplace-deposits/index.ts <phase>')
    console.error(`Available phases: ${Object.keys(phaseMap).join(', ')}`)
    process.exit(2)
  }
  for (const phase of args) {
    const fn = phaseMap[phase]
    if (!fn) {
      console.error(`Неизвестная фаза: «${phase}». Доступно: ${Object.keys(phaseMap).join(', ')}`)
      process.exit(2)
    }
    log(`=== фаза ${phase} ===`)
    await fn()
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
