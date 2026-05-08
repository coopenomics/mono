/**
 * Загрузка исходных данных для таба «Пайщики» на странице Кошельки.
 *
 * Программы и кошельки — через GraphQL контроллера (ADR: фронт не ходит
 * в чейн напрямую). Контроллер читает `soviet::programs` для метаданных
 * программ и `ledger2::userwallets` через `getProgramWallets` для
 * пользовательских срезов (Эпик 3, ADR-008). Пайщиков (ФИО + username +
 * статус) грузит страница отдельно через `useAccountStore.getAccounts`.
 *
 * Возвращаем собранный pivot-срез «program_id → username → cell» — страница
 * только рендерит.
 */
import { client } from 'src/shared/api/client'
import { Queries } from '@coopenomics/sdk'
import { Ledger2 } from 'cooptypes'

export interface IProgramColumn {
  id: number
  title: string
  program_type: string   // 'wallet' | 'generator' | 'blagorost' | ...
  is_active: number
}

export interface IWalletCell {
  available: number
  blocked: number
}

export interface IProgramsAndWallets {
  programs: IProgramColumn[]
  /** matrix[username][program_id] → {available, blocked}. Отсутствие ключа = кошелька нет. */
  matrix: Record<string, Record<number, IWalletCell>>
  /** Сумма по каждой программе (по всем кошелькам). */
  totals: Record<number, IWalletCell>
}

function parseAsset(s: unknown): number {
  if (!s) return 0
  if (typeof s !== 'string') return 0
  const parts = s.trim().split(/\s+/)
  const n = parseFloat(parts[0] ?? '0')
  return Number.isFinite(n) ? n : 0
}

export async function loadProgramsAndWallets(
  coopname: string,
): Promise<IProgramsAndWallets> {
  const [programsResponse, walletsResponse] = await Promise.all([
    client.Query(Queries.Agreements.CooperativePrograms.query, {
      variables: { coopname },
    }),
    client.Query(Queries.Wallet.GetProgramWallets.query, {
      variables: {
        filter: { coopname },
        options: { page: 1, limit: 100000 },
      },
    }),
  ])

  const programsRaw = programsResponse[Queries.Agreements.CooperativePrograms.name] ?? []

  const programs: IProgramColumn[] = programsRaw
    .filter((p) => p.is_active)
    .map((p) => {
      const id = Number(p.id)
      const desc = Ledger2.getProgramDescriptor(id)
      // title — UI-метка из реестра (`ЦПП Генератор` и т.п.), а не chain-title.
      // Менять централизованно в cooptypes/src/ledger2/programs.ts.
      return {
        id,
        title: Ledger2.getProgramLabel(id),
        program_type: desc?.internal_name ?? String(p.program_type ?? ''),
        is_active: p.is_active ? 1 : 0,
      }
    })
    .sort((a, b) => a.id - b.id)

  const matrix: Record<string, Record<number, IWalletCell>> = {}
  const totals: Record<number, IWalletCell> = {}
  for (const p of programs) totals[p.id] = { available: 0, blocked: 0 }

  const wallets = walletsResponse[Queries.Wallet.GetProgramWallets.name]?.items ?? []

  for (const w of wallets) {
    const username = String(w.username)
    const program_id = Number(w.program_id)
    const avail = parseAsset(w.available)
    const blocked = parseAsset(w.blocked)
    if (!matrix[username]) matrix[username] = {}
    matrix[username][program_id] = { available: avail, blocked }
    const t = totals[program_id]
    if (t) {
      t.available += avail
      t.blocked += blocked
    }
  }

  return { programs, matrix, totals }
}
