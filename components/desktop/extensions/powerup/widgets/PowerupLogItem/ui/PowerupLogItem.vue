<template lang="pug">
.log-details
  .detail-row
    span.detail-label Тип операции
    span.detail-value
      BaseBadge(:variant="getTypeVariant(log.type)") {{ getTypeLabel(log.type) }}

  .detail-row
    span.detail-label Сумма
    span.detail-value {{ log.amount }}

  .detail-row
    span.detail-label RAM
    span.detail-value {{ formatBytes(log.resources.ram_usage) }} / {{ formatBytes(log.resources.ram_quota) }} ({{ calculateRamPercent(log.resources.ram_usage, log.resources.ram_quota).toFixed(2) }}% использовано)

  .detail-row
    span.detail-label CPU
    span.detail-value {{ formatCpuNet(log.resources.cpu_limit) }} ({{ calculateCpuNetPercent(log.resources.cpu_limit).toFixed(2) }}% использовано)

  .detail-row
    span.detail-label NET
    span.detail-value {{ formatCpuNet(log.resources.net_limit) }} ({{ calculateCpuNetPercent(log.resources.net_limit).toFixed(2) }}% использовано)
</template>

<script lang="ts" setup>
import { BaseBadge } from 'src/shared/ui/base/BaseBadge'
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge'

interface PowerupLog {
  type: 'daily' | 'now'
  amount: string
  timestamp?: string
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
  return type === 'daily' ? 'Ежедневное пополнение' : 'Немедленное пополнение'
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

const formatCpuNet = (resource: any) => {
  if (!resource || typeof resource !== 'object') return 'N/A'

  const available = resource.available || resource.current_used || 0
  const max = resource.max || 0

  return `${formatBytes(available)} / ${formatBytes(max)}`
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
