/**
 * CLI-диспетчер seed-фаз Стола заказов.
 *
 *   pnpm --filter @coopenomics/boot exec esno src/scripts/seed-marketplace/index.ts <phase>
 *   ...                                                                            --up-to=<phase>
 *   ...                                                                            all
 *
 * Фазы готовят стенд до состояния, в котором UI-сценарий проверяет ровно свой
 * экран, а не всю предысторию. Каждая фаза идемпотентна: повторный прогон без
 * reboot — no-op.
 *
 * Сценарии заявляют нужные фазы в `meta.prepare` (формат `marketplace:<phase>`).
 *
 * Логи — в stderr, stdout остаётся чистым.
 */
import { phase01 } from './phases/01-l1-accept'
import { phase02 } from './phases/02-branches'

const PHASES: Record<string, () => Promise<void>> = {
  '01-l1-accept': phase01,
  '02-branches': phase02,
}

const PHASE_ORDER = Object.keys(PHASES)

function usage(): never {
  console.error('Usage: seed-marketplace <phase> [<phase> ...] | --up-to=<phase> | all')
  console.error(`Available phases: ${PHASE_ORDER.join(', ')}`)
  process.exit(2)
}

async function runPhases(names: string[]) {
  for (const name of names) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`Unknown phase: ${name}`)
      console.error(`Available: ${PHASE_ORDER.join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-marketplace: ${name} ===`)
    await fn()
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) usage()

  if (args.length === 1 && args[0] === 'all') {
    await runPhases(PHASE_ORDER)
    return
  }

  const upTo = args.find(a => a.startsWith('--up-to='))
  if (upTo) {
    const target = upTo.slice('--up-to='.length)
    const idx = PHASE_ORDER.indexOf(target)
    if (idx < 0) {
      console.error(`Unknown phase in --up-to: ${target}`)
      console.error(`Available: ${PHASE_ORDER.join(', ')}`)
      process.exit(2)
    }
    await runPhases(PHASE_ORDER.slice(0, idx + 1))
    return
  }

  await runPhases(args)
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
