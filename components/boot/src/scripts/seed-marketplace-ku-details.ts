/* eslint-disable node/prefer-global/process */
/**
 * CLI-обёртка для сидинга карты ПВЗ (3 КУ Подмосковья krg/odn/myt, ACTIVE)
 * в `marketplace_ku_details`. Запускается из `extra_reboot.sh` ПОСЛЕ подъёма
 * контроллера (он создаёт таблицу через TypeORM synchronize), чтобы свежий
 * стенд сразу имел непустой select ПВЗ. Идемпотентно.
 *
 *   pnpm --filter @coopenomics/boot run seed:marketplace-ku
 */
import { seedMarketplaceKuDetails } from '../postgres-init'

seedMarketplaceKuDetails()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('seed:marketplace-ku failed:', e)
    process.exit(1)
  })
