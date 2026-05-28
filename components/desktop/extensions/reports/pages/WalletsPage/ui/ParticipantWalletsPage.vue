<template lang="pug">
div.page-shell
  q-card(flat)
    q-table.full-height.pw-table(
      flat
      :grid='isMobile'
      :rows='rows'
      :columns='columns'
      row-key='username'
      :pagination='pagination'
      :loading='loading'
      :no-data-label='"Нет пайщиков (status=accepted)"'
    )
      template(#header='props')
        q-tr(:props='props')
          q-th(v-for='col in props.cols' :key='col.name' :props='props')
            template(v-if='col.name.startsWith("prog_")')
              .prog-title {{ col.label }}
              .prog-type.caption-muted {{ programTypeFor(col.name) }}
            template(v-else)
              | {{ col.label }}

      template(#body='props')
        q-tr(:key='`pw_${props.row.username}`' :props='props')
          q-td.col-user(auto-width)
            .name {{ getName(props.row) || '—' }}
            .username.caption-muted {{ props.row.username }}

          q-td.text-right(
            v-for='prog in data.programs'
            :key='`${props.row.username}_${prog.id}`'
            :class='cellClass(data.matrix[props.row.username]?.[prog.id])'
          )
            WalletCell(:cell='data.matrix[props.row.username]?.[prog.id]')

          q-td.text-right
            WalletCell(:cell='totalFor(props.row.username)' bold)

          q-td.text-right(auto-width)
            q-btn(
              flat dense round size='sm' color='primary'
              icon='fa-solid fa-arrow-right'
              :to='{ name: "reports-operations", query: { username: props.row.username } }'
            )
              q-tooltip К операциям пайщика

      template(#bottom-row)
        q-tr.row-totals
          q-td.text-weight-bold Σ по программе
          q-td.text-right(
            v-for='prog in data.programs'
            :key='`total_${prog.id}`'
          )
            WalletCell(:cell='data.totals[prog.id]' bold)
          q-td.text-right
            WalletCell(:cell='grandTotal' bold)
          q-td

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-body1 {{ getName(props.row) || '—' }}
                .text-caption.caption-muted {{ props.row.username }}
              .col-auto
                q-btn(
                  flat dense size='sm' color='primary'
                  icon='fa-solid fa-arrow-right'
                  label='Операции'
                  :to='{ name: "reports-operations", query: { username: props.row.username } }'
                )
            .row.q-mt-sm(v-for='prog in data.programs' :key='`m_${props.row.username}_${prog.id}`')
              .col-6.text-caption.caption-muted {{ prog.title }}
              .col-6.text-right
                WalletCell(:cell='data.matrix[props.row.username]?.[prog.id]')
            .row.q-mt-sm
              .col-6.text-weight-bold Итого
              .col-6.text-right
                WalletCell(:cell='totalFor(props.row.username)' bold)
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { QIcon, QTooltip } from 'quasar'
import { FailAlert } from 'src/shared/api'
import { useSystemStore } from 'src/entities/System/model'
import { useAccountStore } from 'src/entities/Account/model'
import { useWindowSize } from 'src/shared/hooks'
import { formatAsset2Digits, getName } from 'src/shared/lib/utils'
import type { IAccount } from 'src/entities/Account/types'
import {
  loadProgramsAndWallets,
  type IProgramsAndWallets,
  type IWalletCell,
} from './participant-wallets-api'

const { info } = useSystemStore()
const accountStore = useAccountStore()
const { isMobile } = useWindowSize()

const loading = ref(false)
const pagination = ref({ rowsPerPage: 0 })
const data = ref<IProgramsAndWallets>({
  programs: [],
  matrix: {},
  totals: {},
})
const rows = ref<IAccount[]>([])

function programTypeFor(colName: string): string {
  const id = Number(colName.replace('prog_', ''))
  return data.value.programs.find((p) => p.id === id)?.program_type ?? ''
}

function totalFor(username: string): IWalletCell {
  const row = data.value.matrix[username]
  if (!row) return { available: 0 }
  let a = 0
  for (const c of Object.values(row)) {
    a += c.available
  }
  return { available: a }
}

const grandTotal = computed<IWalletCell>(() => {
  let a = 0
  for (const c of Object.values(data.value.totals)) {
    a += c.available
  }
  return { available: a }
})

function cellClass(cell?: IWalletCell): string {
  if (!cell) return 'cell-empty'
  if (cell.available === 0) return 'cell-zero'
  return 'cell-has-value'
}

// Колонки собираем динамически: одна колонка на активную программу плюс
// фиксированные «Пайщик / Итого / действия». sortable=true везде где поле
// сводится к числу — q-table сортирует по возвращаемому field()-у.
const columns = computed(() => {
  const progCols = data.value.programs.map((prog) => ({
    name: `prog_${prog.id}`,
    align: 'right' as const,
    label: prog.title,
    field: (row: IAccount) => {
      const c = data.value.matrix[row.username]?.[prog.id]
      return c ? c.available : 0
    },
    sortable: true,
  }))
  return [
    {
      name: 'name',
      align: 'left' as const,
      label: 'ФИО / Наименование',
      field: (row: IAccount) => getName(row) || row.username,
      sortable: true,
    },
    ...progCols,
    {
      name: 'total',
      align: 'right' as const,
      label: 'Итого',
      field: (row: IAccount) => {
        const t = totalFor(row.username)
        return t.available
      },
      sortable: true,
    },
    {
      name: 'actions',
      align: 'right' as const,
      label: '',
      field: 'username',
      sortable: false,
    },
  ]
})

// Inline-рендер ячейки «доступно». Вынесен в h-function, чтобы не таскать ещё
// одну SFC. Иконка lock-open + q-tooltip «Доступно».
const WalletCell = {
  name: 'WalletCell',
  props: {
    cell: { type: Object as () => IWalletCell | undefined, default: undefined },
    bold: { type: Boolean, default: false },
  },
  setup(props: { cell?: IWalletCell; bold?: boolean }) {
    return () => {
      const c = props.cell
      if (!c) {
        return h('div', { class: 'cell-dash' }, '—')
      }
      const valueClass = c.available > 0 ? 'value-avail' : 'value-zero'
      return h('div', { class: 'wallet-cell' }, [
        h(
          'div',
          { class: ['cell-line', valueClass, props.bold ? 'bold' : ''].join(' ') },
          [
            h(QIcon, { name: 'fa-solid fa-lock-open', size: '12px', class: 'cell-icon' }),
            h('span', { class: 'cell-value' }, formatAsset2Digits(`${c.available} RUB`)),
            h(QTooltip, { anchor: 'top middle', self: 'bottom middle', delay: 200 }, () => 'Доступно'),
          ],
        ),
      ])
    }
  },
}

async function reload(): Promise<void> {
  loading.value = true
  try {
    await Promise.all([
      loadProgramsAndWallets(info.coopname).then((d) => { data.value = d }),
      accountStore.getAccounts({ options: { page: 1, limit: 1000, sortOrder: 'DESC' } }),
    ])
    // accounts: только accepted-пайщики, сортировка по ФИО/username для читаемости.
    rows.value = accountStore.accounts.items
      .filter((a) => a.participant_account?.status === 'accepted')
      .slice()
      .sort((a, b) => {
        const an = (getName(a) || a.username).toLowerCase()
        const bn = (getName(b) || b.username).toLowerCase()
        return an.localeCompare(bn, 'ru')
      })
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить кошельки пайщиков')
  } finally {
    loading.value = false
  }
}

defineExpose({ reload })

onMounted(() => void reload())
</script>

<style scoped lang="scss">
// Канон-токены сами адаптируются к тёмной теме — без rgba-хардкода.
.caption-muted {
  color: var(--p-ink-2);
}

.pw-table {
  :deep(thead th) {
    font-weight: 600;
    white-space: nowrap;
    vertical-align: bottom;

    .prog-title {
      font-size: 13px;
      line-height: 1.2;
    }
    .prog-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  :deep(.row-totals) {
    background: var(--p-surface-2);
    font-weight: 600;

    td {
      border-top: 2px solid var(--p-line-2);
    }
  }

  .col-user {
    .name {
      font-size: 14px;
      font-weight: 500;
      color: inherit;
      line-height: 1.25;
    }
    .username {
      font-size: 11px;
      margin-top: 2px;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      letter-spacing: 0.02em;
    }
  }

  .cell-zero :deep(.wallet-cell) {
    opacity: 0.4;
  }
}
</style>

<!--
  «available» рендерится через render-функцию `WalletCell`,
  у которой нет своего scoped-id. scoped + :deep до неё не доходит
  стабильно, поэтому стили лежат в global-блоке. Класс `.wallet-cell`
  достаточно специфичен — конфликтов с другими компонентами нет.
-->
<style lang="scss">
.wallet-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  line-height: 1.3;

  .cell-line {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    font-weight: 500;

    &.value-avail { color: var(--p-pos); }
    &.value-blocked { color: var(--p-warn); }
    &.value-zero {
      color: var(--p-ink-3);
      font-weight: 400;
    }
    &.bold { font-weight: 700; }
  }

  .cell-icon {
    flex-shrink: 0;
    opacity: 0.85;
  }

  .cell-dash {
    color: var(--p-ink-3);
  }
}
</style>
