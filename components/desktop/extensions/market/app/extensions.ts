import { Ledger2 } from 'cooptypes'
import { processInfoFactory } from 'src/shared/lib/process-info-factory'
import { ProcessSupplyInfoWidget } from 'src/widgets/Marketplace/ProcessSupplyInfoWidget'
import { ProcessReturnInfoWidget } from 'src/widgets/Marketplace/ProcessReturnInfoWidget'
import { ProcessWriteoffInfoWidget } from 'src/widgets/Marketplace/ProcessWriteoffInfoWidget'

/**
 * Регистрация прикладных info-widget'ов «Содержание процесса» для стола
 * бухгалтера. Сами проводки/кошельки/документы остаются в `extensions/reports`
 * — здесь мы только описываем бизнес-смысл процессов marketplace, чтобы
 * председатель и бухгалтер видели заказчика, поставщика, КУ, ссылку на
 * соответствующий стол ПВЗ/админа.
 *
 * Идентификатор process_type берём из `Ledger2.LEDGER2_PROCESS_REGISTRY`
 * (источник правды), а не строкой — переименование процесса синхронно
 * подцепится по полю `name` (`SUPPLY` / `RETURN` / `WRITEOFF`).
 */
function processTypeByName(name: string): string {
  const meta = Ledger2.LEDGER2_PROCESS_REGISTRY.find(
    (p) => p.contract === 'marketplace' && p.name === name,
  )
  if (!meta) {
    throw new Error(
      `[market/extensions] process_type marketplace::${name} отсутствует в LEDGER2_PROCESS_REGISTRY`,
    )
  }
  return meta.type
}

export function registerMarketplaceProcessInfoHandlers(): void {
  processInfoFactory.registerHandler(processTypeByName('SUPPLY'), {
    infoComponent: ProcessSupplyInfoWidget,
  })
  processInfoFactory.registerHandler(processTypeByName('RETURN'), {
    infoComponent: ProcessReturnInfoWidget,
  })
  processInfoFactory.registerHandler(processTypeByName('WRITEOFF'), {
    infoComponent: ProcessWriteoffInfoWidget,
  })
}
