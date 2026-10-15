/**
 * Прикладные метрики узла на GET /metrics
 * (test-registry/coop.chain-resources.yaml, coop.res.side.06).
 *
 * Мониторинг забирает показатели кооператива текстом Prometheus: ресурсы
 * аккаунта кооператива в цепи (память, процессорное время, полоса, остаток
 * системного токена), состав пайщиков, отставание чтения цепи. По ресурсам
 * видно заранее, что кооперативу скоро нечем будет платить за действия.
 */
import { describe, expect, it } from 'vitest'
import { API_URL, caseName, waitFor } from '../core'

function metricsUrl(): string {
  return new URL('/metrics', API_URL).toString()
}

/** Значение показателя без меток либо первое значение с метками. */
function value(text: string, name: string): number | null {
  const line = text.split('\n').find(l => l.startsWith(`${name} `) || l.startsWith(`${name}{`))
  if (!line)
    return null
  return Number(line.trim().split(/\s+/).pop())
}

describe('метрики узла', () => {
  it(caseName('coop.res.side.06', 'ресурсы аккаунта кооператива отдаются: память, процессорное время, полоса и остаток системного токена'), async () => {
    // Показатели собираются тиком: ждём первый успешный сбор.
    const text = await waitFor(async () => {
      const res = await fetch(metricsUrl())
      if (res.status !== 200)
        return null
      const body = await res.text()
      return value(body, 'coop_account_ram_quota_bytes') ? body : null
    }, { timeoutMs: 120_000, intervalMs: 3_000, label: 'метрики ресурсов аккаунта собраны' })

    const ramUsed = value(text, 'coop_account_ram_used_bytes')
    const ramQuota = value(text, 'coop_account_ram_quota_bytes')
    expect(ramQuota).toBeGreaterThan(0)
    expect(ramUsed).toBeGreaterThan(0)
    expect(ramUsed!).toBeLessThanOrEqual(ramQuota!)
    for (const name of ['coop_account_cpu_used_microseconds', 'coop_account_cpu_max_microseconds', 'coop_account_net_used_bytes', 'coop_account_net_max_bytes', 'coop_account_system_token_balance']) {
      const v = value(text, name)
      expect(v, `показатель ${name} отдан`).not.toBeNull()
      expect(Number.isFinite(v!), `${name} — число`).toBe(true)
      expect(v!).toBeGreaterThanOrEqual(0)
    }
    expect(value(text, 'coop_account_cpu_max_microseconds')).toBeGreaterThan(0)
    expect(value(text, 'coop_account_net_max_bytes')).toBeGreaterThan(0)
  })

  it(caseName('coop.res.side.09', 'состав кооператива и чтение цепи в метриках: пайщики посчитаны, узел синхронизирован'), async () => {
    const text = await (await fetch(metricsUrl())).text()
    expect(value(text, 'coop_users_total')).toBeGreaterThan(0)
    expect(value(text, 'coop_chain_participants_total')).toBeGreaterThan(0)
    expect(value(text, 'coop_chain_head_block')).toBeGreaterThan(0)
    expect(value(text, 'coop_parser_current_block')).toBeGreaterThan(0)
    expect(value(text, 'coop_parser_synced')).toBe(1)
    expect(value(text, 'coop_platform_metrics_last_success_timestamp_seconds')).toBeGreaterThan(0)
  })
})
