<template lang="pug">
.log-details
  .detail-row
    span.detail-label {{ $t('powerup.powerupLogItem.operationTypeLabel') }}
    span.detail-value
      BaseBadge(:variant="getTypeVariant(log.type)") {{ getTypeLabel(log.type) }}

  .detail-row
    span.detail-label {{ $t('powerup.powerupLogItem.amountLabel') }}
    span.detail-value {{ log.amount }}

  .detail-row
    span.detail-label RAM
    span.detail-value {{ $t('powerup.powerupLogItem.ramUsageText', { used: formatBytes(log.resources.ram_usage), quota: formatBytes(log.resources.ram_quota), percent: calculateRamPercent(log.resources.ram_usage, log.resources.ram_quota).toFixed(2) }) }}

  .detail-row
    span.detail-label CPU
    span.detail-value {{ $t('powerup.powerupLogItem.cpuUsageText', { value: formatCpuTime(log.resources.cpu_limit), percent: calculateCpuNetPercent(log.resources.cpu_limit).toFixed(2) }) }}

  .detail-row
    span.detail-label NET
    span.detail-value {{ $t('powerup.powerupLogItem.netUsageText', { value: formatNet(log.resources.net_limit), percent: calculateCpuNetPercent(log.resources.net_limit).toFixed(2) }) }}

  .detail-row(v-if="log.trx_id")
    span.detail-label {{ $t('powerup.powerupLogItem.transactionLabel') }}
    span.detail-value {{ log.trx_id.slice(0, 16) }}…
</template>

<script lang="ts" setup>
import { BaseBadge } from 'src/shared/ui/base/BaseBadge'
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge'
import { t } from '../../../i18n';

interface PowerupLog {
  type: 'daily' | 'now'
  amount: string
  timestamp?: string
  /** Транзакция пополнения в цепи. Запись в журнале появляется только после неё. */
  trx_id?: string
  resources: {
    username: string
    ram_usage: any
    ram_quota: any
    net_limit: any
    cpu_limit: any
  }
}

interface Props {
  log: PowerupLog
}

defineProps<Props>()

const getTypeLabel = (type: string) => {
  return type === 'daily' ? t('powerup.powerupLogItem.dailyTypeLabel') : t('powerup.powerupLogItem.immediateTypeLabel')
}

const getTypeVariant = (type: string): BaseBadgeVariant => {
  return type === 'daily' ? 'pos' : 'info'
}

const formatBytes = (value: any) => {
  if (!value) return '0 B'
  const bytes = typeof value === 'string' ? parseInt(value) : value
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Полоса меряется в байтах, процессорное время — в микросекундах. Раньше обе
// величины печатались байтами, и час процессорного времени выглядел как «36 ГБ».
const formatNet = (resource: any) => {
  if (!resource || typeof resource !== 'object') return 'N/A'

  const available = resource.available || resource.current_used || 0
  const max = resource.max || 0

  return `${formatBytes(available)} / ${formatBytes(max)}`
}

const formatMicroseconds = (value: any) => {
  const us = typeof value === 'string' ? parseInt(value) : value || 0
  if (!us) return t('powerup.powerupLogItem.microsecondsZero')
  if (us < 1_000) return t('powerup.powerupLogItem.microseconds', { value: us })
  if (us < 1_000_000) return t('powerup.powerupLogItem.milliseconds', { value: (us / 1_000).toFixed(2) })
  if (us < 60 * 1_000_000) return t('powerup.powerupLogItem.seconds', { value: (us / 1_000_000).toFixed(2) })
  if (us < 3600 * 1_000_000) return t('powerup.powerupLogItem.minutesShort', { value: (us / 60_000_000).toFixed(2) })
  return t('powerup.powerupLogItem.hoursShort', { value: (us / 3_600_000_000).toFixed(2) })
}

const formatCpuTime = (resource: any) => {
  if (!resource || typeof resource !== 'object') return 'N/A'

  const available = resource.available || resource.current_used || 0
  const max = resource.max || 0

  return `${formatMicroseconds(available)} / ${formatMicroseconds(max)}`
}

const calculateRamPercent = (usage: any, quota: any) => {
  const usageNum = typeof usage === 'string' ? parseInt(usage) : usage || 0
  const quotaNum = typeof quota === 'string' ? parseInt(quota) : quota || 0

  if (!quotaNum) return 0
  return (usageNum / quotaNum) * 100
}

const calculateCpuNetPercent = (resource: any) => {
  if (!resource || typeof resource !== 'object') return 0

  const currentUsed = resource.current_used || 0
  const max = resource.max || 0

  if (!max) return 0
  return (parseInt(currentUsed) / parseInt(max)) * 100
}
</script>

<style lang="scss" scoped>
.log-details {
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);

    &:last-child {
      border-bottom: none;
    }
  }

  .detail-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  .detail-value {
    font-size: var(--p-fs-mono, 13px);
    font-weight: 600;
    color: var(--p-ink);
    font-family: var(--p-mono);
    text-align: right;
  }
}
</style>
