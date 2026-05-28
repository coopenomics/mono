<template lang="pug">
.branches-page
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      p.q-mt-none.q-mb-sm Создание кооперативных участков сейчас происходит за пределами цифровой системы. Здесь добавляются уже созданные и юридически оформленные участки с их председателями.
      p.q-my-none При добавлении трёх участков кооператив автоматически переходит на мажоритарную систему управления. Действующим пайщикам будет предложено выбрать участок и делегировать голос его председателю. Новые пайщики делают выбор при регистрации.

  q-table(
    flat
    :rows="branches || []"
    :columns="columns"
    row-key="braname"
    :pagination="pagination"
    virtual-scroll
    :virtual-scroll-item-size="48"
    :loading="onLoading"
    class="transparent-table"
  )

    template(#header="props")
      q-tr(:props="props")
        q-th(auto-width)
        q-th(v-for="col in props.cols" :key="col.name" :props="props") {{ col.label }}

    template(#body="props")
      q-tr(:key="`m_${props.row.braname}`" :props="props")
        q-td(auto-width)
          q-btn(
            size="sm"
            color="primary"
            dense
            :icon="expanded.get(props.row.braname) ? 'remove' : 'add'"
            round
            @click="toggleExpand(props.row.braname)"
          )
        q-td {{ props.row.short_name }}
        q-td {{ getNameFromUserData(props.row.trustee) }}
      q-tr(
        v-if="expanded.get(props.row.braname)"
        :key="`e_${props.row.braname}`"
        :props="props"
        class="q-virtual-scroll--with-prev"
      )
        q-td(colspan="100%")
          div.row
            div.col-md-4.col-xs-12.q-pa-sm
              p.text-center.text-overline карточка участка
              BranchCard(:branch="props.row")
            div.col-md-4.col-xs-12.q-pa-sm
              p.text-center.text-overline карточка счёта
              BankDetailsCard(:bankDetails="props.row.bank_account")
            div.col-md-4.col-xs-12.q-pa-sm
              p.text-center.text-overline карточка председателя
              EditableIndividualCard(:participantData="props.row.trustee" :readonly="true").q-mt-sm
              div.text-wrap
                p.t-muted для замены председателя участка — измените его имя аккаунта в карточке участка на аккаунт одного из пайщиков.
              div.q-mt-md.flex.justify-center
                DeleteBranchButton(:branch="props.row")
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useBranchStore } from 'src/entities/Branch/model';
import { useEditableTableRows } from 'src/shared/lib/composables/useEditableTableRows';
import { CreateBranchButton } from 'src/features/Branch/CreateBranch';
import { DeleteBranchButton } from 'src/features/Branch/DeleteBranch';
import { getNameFromUserData } from 'src/shared/lib/utils/getNameFromUserData';
import { BranchCard } from 'src/widgets/BranchCard';
import { EditableIndividualCard } from 'src/shared/ui/EditableIndividualCard';
import { BankDetailsCard } from 'src/widgets/BankDetailsCard';
import { useSystemStore } from 'src/entities/System/model';
import { useHeaderActions } from 'src/shared/hooks';

const { info } = useSystemStore();
const branchStore = useBranchStore();
const { registerAction } = useHeaderActions();

branchStore.loadBranches({
  coopname: info.coopname,
});

const onLoading = ref(false);

const branches = computed(() => branchStore.branches);

const columns = [
  { name: 'short_name', label: 'Название', align: 'left', field: 'short_name', sortable: true },
  { name: 'trustee', label: 'Председатель', align: 'left', field: 'trustee', sortable: true },
] as any;

const rowKey = 'braname';

const { expanded, toggleExpand } = useEditableTableRows({
  rows: branches,
  rowKey,
});

const pagination = ref({ rowsPerPage: 0 });

onMounted(() => {
  registerAction({
    id: 'create-branch',
    component: CreateBranchButton,
    order: 1,
  });
});
</script>

<style scoped lang="scss">
.branches-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}

.table-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 2px 10px;
}

.banner-title {
  font-size: 18px;
  font-weight: 600;
}

.banner-meta {
  line-height: 1.4;
}

.transparent-table :deep(.q-table__container) {
  background: transparent;
  box-shadow: none;
}

.transparent-table :deep(.q-table__top) {
  padding: 0 4px 8px;
}

.transparent-table :deep(th) {
  font-weight: 600;
}

.table-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.table-note {
  font-size: 13px;
}

@media (max-width: 768px) {
  .table-head {
    align-items: flex-start;
  }

  .table-top {
    align-items: flex-start;
  }
}
</style>
