<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { useManageTrusted } from 'src/features/Branch/ManageTrusted'
import { BaseBadge, BaseButton, BaseDialog, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { UserSearchSelector } from 'src/shared/ui'

/**
 * Стол ПВЗ → «Доверенные лица». Председатель кооперативного участка (trustee)
 * добавляет и снимает доверенных лиц своего КУ — они получают те же
 * операционные права по Столу ПВЗ (приёмка, выдача, маркировка, склад).
 *
 * Активный КУ берётся из общего контекста оператора (entities/OperatorBranch),
 * коды участков в UI не показываются. Список доверенных и ФИО приходят из
 * core-карточки КУ (доступна председателю/совету); правки гейтятся
 * `isChairman` — это совпадает с auth core-мутаций addtrusted/deltrusted.
 */

const route = useRoute()
const session = useSessionStore()
const store = useOperatorBranchStore()
const { addTrusted, deleteTrusted } = useManageTrusted()

const coopname = computed(() => String(route.params.coopname ?? ''))
const canManage = computed(() => session.isChairman ?? false)

// Колонки скелетона повторяют шапку таблицы (колонка действий — только когда есть права).
const skeletonColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Лицо' },
  { label: 'Аккаунт', class: 'col-acc' },
  { label: 'Роль', class: 'col-role', cell: 'badge' },
  ...(canManage.value ? [{ label: 'Действия', class: 'col-action', cell: 'icon' as const }] : []),
])

const active = computed(() => store.activeBranch)
const branch = computed(() => active.value?.branch ?? null)

interface PersonRow {
  username: string
  name: string
  isTrustee: boolean
}

function personName(p: { first_name?: string; last_name?: string; middle_name?: string; username: string }): string {
  const full = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ').trim()
  return full || p.username
}

const rows = computed<PersonRow[]>(() => {
  const b = branch.value
  if (!b) return []
  const out: PersonRow[] = [{ username: b.trustee.username, name: personName(b.trustee), isTrustee: true }]
  for (const t of b.trusted) {
    out.push({ username: t.username, name: personName(t), isTrustee: false })
  }
  return out
})

const trustedCount = computed(() => rows.value.filter((r) => !r.isTrustee).length)

function roleBadge(row: PersonRow): { label: string; variant: BaseBadgeVariant } {
  return row.isTrustee
    ? { label: 'Председатель КУ', variant: 'pos' }
    : { label: 'Доверенное лицо', variant: 'neutral' }
}

// ─── Добавление ───
// Аккаунт выбирается поиском по ФИО (UserSearchSelector) — как при выборе
// председателя/секретаря собрания; в модели остаётся username выбранного пайщика.
// Селектор может обнулить значение (undefined) при очистке — отсюда `?.`.
const newUsername = ref<string | undefined>('')
const adding = ref(false)
const canAdd = computed(() => !!newUsername.value?.trim() && !!store.activeBraname && canManage.value)

async function onAdd(): Promise<void> {
  if (!canAdd.value || !store.activeBraname) return
  adding.value = true
  try {
    await addTrusted({
      coopname: coopname.value,
      braname: store.activeBraname,
      trusted: newUsername.value!.trim(),
    })
    SuccessAlert('Доверенное лицо добавлено')
    newUsername.value = ''
    await store.load(coopname.value)
  } catch (e) {
    FailAlert(e, 'Не удалось добавить доверенное лицо')
  } finally {
    adding.value = false
  }
}

// ─── Удаление ───
const removeTarget = ref<PersonRow | null>(null)
const removeOpen = ref(false)
const removing = ref(false)

function askRemove(row: PersonRow): void {
  removeTarget.value = row
  removeOpen.value = true
}

async function onRemove(): Promise<void> {
  const target = removeTarget.value
  if (!target || !store.activeBraname) return
  removing.value = true
  try {
    await deleteTrusted({
      coopname: coopname.value,
      braname: store.activeBraname,
      trusted: target.username,
    })
    SuccessAlert('Доверенное лицо снято')
    removeOpen.value = false
    removeTarget.value = null
    await store.load(coopname.value)
  } catch (e) {
    FailAlert(e, 'Не удалось снять доверенное лицо')
  } finally {
    removing.value = false
  }
}

onMounted(() => {
  void store.ensureLoaded(coopname.value)
})
</script>

<template lang="pug">
q-page.trusted
  OperatorBranchBar

  EmptyState(
    v-if='store.loaded && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Стол ПВЗ доступен председателю участка и его доверенным лицам. Управление доверенными лицами появится, когда вы станете оператором КУ.'
  )
    template(#icon)
      q-icon(name='group_off', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-trusted:banner-dismissed')
      | Доверенные лица получают те же права на этом пункте выдачи, что и
      | председатель участка: приёмка партий, маркировка, выдача заказов,
      | гарантийные возвраты и склад. Добавляйте только тех пайщиков, кому
      | доверяете операции от имени участка.

    .trusted__add(v-if='canManage')
      UserSearchSelector.trusted__add-input(
        v-model='newUsername',
        label='Пайщик (поиск по ФИО)',
        outlined,
        dense
      )
      BaseButton(
        variant='primary',
        :loading='adding',
        :disabled='!canAdd',
        @click='onAdd'
      )
        template(#icon-left)
          q-icon(name='person_add', size='16px')
        | Добавить

    .banner.banner--info(v-else-if='!branch')
      q-icon.banner__icon(name='info', size='18px')
      .banner__body
        | Список доверенных лиц участка доступен председателю кооператива.

    //- Канон загрузки: скелетон-таблица на первичной загрузке, не пустой экран.
    TableSkeleton(v-if='!store.loaded && !rows.length', :columns='skeletonColumns')

    .trusted__counter(v-if='rows.length')
      | Доверенных лиц: {{ trustedCount }}

    .table-wrap(v-if='rows.length')
      .table-scroll
        table.table
          thead
            tr
              th Лицо
              th.col-acc Аккаунт
              th.col-role Роль
              th.col-action(v-if='canManage') Действия
          tbody
            tr(v-for='row in rows', :key='row.username')
              td.trusted__name {{ row.name }}
              td.col-acc
                span.trusted__acc {{ row.username }}
              td.col-role
                BaseBadge(:variant='roleBadge(row).variant') {{ roleBadge(row).label }}
              td.col-action(v-if='canManage')
                BaseButton(
                  v-if='!row.isTrustee',
                  variant='ghost',
                  icon-only,
                  size='sm',
                  aria-label='Снять доверенное лицо',
                  @click='askRemove(row)'
                )
                  template(#icon-left)
                    q-icon(name='person_remove', size='18px')
                span.trusted__dash(v-else) —

    EmptyState(
      v-else-if='store.loaded && branch',
      title='Доверенных лиц пока нет',
      body='Добавьте доверенных лиц, которым доверяете операции на этом пункте выдачи.'
    )
      template(#icon)
        q-icon(name='group', size='48px')

  BaseDialog(
    v-model='removeOpen',
    title='Снять доверенное лицо',
    size='sm'
  )
    .trusted__confirm(v-if='removeTarget')
      | Снять доверенное лицо «{{ removeTarget.name }}» с этого пункта выдачи?
      | Пайщик потеряет операционные права по участку.
    template(#footer)
      BaseButton(variant='ghost', :disabled='removing', @click='removeOpen = false') Отмена
      BaseButton(variant='primary', :loading='removing', @click='onRemove')
        template(#icon-left)
          q-icon(name='person_remove', size='16px')
        | Снять
</template>

<style scoped lang="scss">
.trusted {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__add {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__add-input {
    max-width: 280px;
    width: 100%;
  }

  &__counter {
    color: var(--p-ink-3);
    font-size: 0.875rem;
  }

  &__name {
    font-weight: 600;
  }

  &__acc {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--p-ink-3);
  }

  &__dash {
    color: var(--p-ink-3);
  }

  &__confirm {
    color: var(--p-ink-2);
    line-height: 1.5;
  }
}

.table {
  table-layout: fixed;
  min-width: 720px;
}
.table-scroll {
  overflow-x: auto;
}
.col-acc {
  width: 200px;
}
.col-role {
  width: 180px;
}
.col-action {
  width: 120px;
  text-align: right;
}

@media (max-width: 768px) {
  .trusted {
    padding: var(--p-4, 16px);
  }
  .trusted__add {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
