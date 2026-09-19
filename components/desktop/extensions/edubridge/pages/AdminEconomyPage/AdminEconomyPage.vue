<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-economy:banner-dismissed")
    | Стоимость курса складывается снизу: часы занятий по ставке преподавателя дают себестоимость,
    | кооператив добавляет наценку. Наценка одна на весь кооператив и покрывает управление программой,
    | издержки и возвраты по Положению ЦПП. Ставка часа у каждого преподавателя своя.

  .row.q-col-gutter-md
    .col-12.col-md-5
      BaseCard(title="Наценка кооператива")
        BaseForm(:loading="savingMarkup" @submit="onSaveMarkup")
          BaseInput(
            v-model="markup"
            label="Наценка, %"
            type="number"
            :hint="`Предельная скидка за годовой объём при этой наценке — ${maxDiscount}%`"
            required
          )
          template(#footer)
            .row.justify-end
              BaseButton(variant="primary" type="submit" :loading="savingMarkup") Сохранить
    .col-12.col-md-7
      BaseCard(title="Как считается взнос")
        DataRow(label="Себестоимость месяца" value="часы занятий × ставка преподавателя")
        DataRow(label="Взнос за месяц" value="себестоимость + наценка кооператива")
        DataRow(label="Взнос за год" value="месячный × 12 со скидкой за объём")
        DataRow(label="Предел скидки" :value="`${maxDiscount}% — ниже себестоимости взнос не опускается`")

  .text-subtitle1.q-mt-lg.q-mb-sm Ставки часа преподавателей

  BaseTable(
    v-if="loading || teachers.length"
    :columns="columns"
    :rows="teachers"
    row-key="username"
    :loading="firstLoad"
    min-width="620px"
  )
    template(#cell-teacher="{ row }")
      IdentityCell(:account-name="row.username" :full-name="row.display_name")
    template(#cell-hourly_rate="{ row }") {{ formatAsset2Digits(row.hourly_rate) }}
    template(#cell-assignments="{ row }") {{ row.assignments_active }} из {{ row.assignments_total }}
    template(#cell-actions="{ row }")
      .row.no-wrap.justify-end
        BaseButton(variant="ghost" size="sm" @click="openRate(row)") Изменить ставку

  EmptyState(v-if="!firstLoad && !teachers.length" title="Преподавателей нет" body="Ставка появляется здесь, когда преподаватель подпишет договор участия в хозяйственной деятельности.")
    template(#icon)
      q-icon(name="payments" size="32px")

  BaseDialog(v-model="rateOpen" title="Ставка часа преподавателя" size="sm")
    BaseForm(:loading="savingRate" @submit="onSaveRate")
      .t-sm.t-muted.q-mb-md(v-if="rateTarget") {{ rateTarget.display_name || rateTarget.username }}
      BaseInput(v-model="rate" label="Ставка часа" type="number" :suffix="symbol" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="rateOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="savingRate") Сохранить
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatToAsset } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { fetchEconomySettings, setEconomySettings, setTeacherRate } from '../../entities/Economy';
import { fetchTeachers, type ITeacher } from '../../entities/Teacher';

/**
 * Экономика программы: наценка кооператива и ставки часа преподавателей.
 * Взнос ученика считается из них, поэтому оба значения живут в одном месте —
 * здесь видно, из чего складывается стоимость курса.
 */
const system = useSystemStore();
const symbol = computed(() => system.governSymbol);

const teachers = ref<ITeacher[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const markup = ref('0');
const maxDiscount = ref(0);
const savingMarkup = ref(false);
const rateOpen = ref(false);
const rateTarget = ref<ITeacher | null>(null);
const rate = ref('');
const savingRate = ref(false);

const columns: BaseTableColumn<ITeacher>[] = [
  { key: 'teacher', label: 'Преподаватель' },
  { key: 'hourly_rate', label: 'Ставка часа', numeric: true, width: '160px', nowrap: true },
  { key: 'assignments', label: 'Назначений', width: '130px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '180px' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [settings, list] = await Promise.all([fetchEconomySettings(), fetchTeachers()]);
    markup.value = String(settings.markup_percent);
    maxDiscount.value = settings.max_year_discount_percent;
    teachers.value = list;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onSaveMarkup(): Promise<void> {
  savingMarkup.value = true;
  try {
    const saved = await setEconomySettings({ markup_percent: Number(markup.value) });
    maxDiscount.value = saved.max_year_discount_percent;
    SuccessAlert('Наценка сохранена — она действует на все курсы кооператива');
  } catch (e) {
    FailAlert(e);
  } finally {
    savingMarkup.value = false;
  }
}

function openRate(row: ITeacher): void {
  rateTarget.value = row;
  rate.value = String(parseFloat(row.hourly_rate) || '');
  rateOpen.value = true;
}

async function onSaveRate(): Promise<void> {
  if (!rateTarget.value) return;
  savingRate.value = true;
  try {
    const hourly_rate = formatToAsset(String(rate.value).replace(',', '.'), symbol.value);
    await setTeacherRate({ username: rateTarget.value.username, hourly_rate });
    teachers.value = teachers.value.map((t) => (t.username === rateTarget.value?.username ? { ...t, hourly_rate } : t));
    rateOpen.value = false;
    SuccessAlert('Ставка сохранена');
  } catch (e) {
    FailAlert(e);
  } finally {
    savingRate.value = false;
  }
}

onMounted(load);
</script>
