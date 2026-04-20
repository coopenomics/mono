import type { Database } from '../../Database'
import { publishDelta } from '../../RedisNotifier'
import type { EosioShipReaderResolved, IDelta } from '../../Types'
import { subsribedTables } from '../../config'
import { DeltaParserFactory } from '../Factory'

export async function DeltasParser(db: Database, reader: EosioShipReaderResolved) {
  const { rows$ } = reader

  // ВАЖНО: передаём Observer ({next,error,complete}), а не один callback.
  // RxJS: если observable эмитит error, subscribe без error-handler'а
  // молча умирает — ship-reader stream разрывается, парсер ЗАМОЛКАЕТ
  // без единого лога. Отдельный error-хук делает это видимым и даёт шанс
  // восстановиться (supervisor-restart контейнером в unless-stopped).
  //
  // try/catch в next-handler'е нужен, чтобы одна сломанная дельта
  // (например, kill'нутый MongoDB на записи) не роняла весь поток: мы
  // логируем проблемный элемент и продолжаем принимать следующие.
  rows$.subscribe({
    next: async (delta: IDelta) => {
      try {
        console.log(`\nDELTA - code: ${delta.code}, scope: ${delta.scope}, table: ${delta.table}, primary_key: ${delta.primary_key}, data: ${JSON.stringify(delta.value)}`)

        const parser = DeltaParserFactory.create(delta.code, delta.scope, delta.table)
        if (parser) {
          await parser.process(db, delta)
          await publishDelta('delta', delta)
        }
      } catch (err) {
        console.error(`Delta handler error (${delta.code}::${delta.table}#${delta.primary_key}):`, err)
      }
    },
    error: (err) => {
      console.error('Delta stream FATAL — ship-reader разорвался, требуется рестарт:', err)
      // Форсируем exit чтобы docker (restart: unless-stopped) поднял заново
      // с актуальным блокчейн-состоянием. Лучше явный crash, чем тихий zombie.
      process.exit(1)
    },
    complete: () => {
      console.warn('Delta stream completed — ship-reader закрыл соединение')
      process.exit(0)
    },
  })

  console.log('Подписка на дельты активирована')
}
