<template lang="pug">
.vars-page
  //- Заголовок страницы показан крошкой в шапке, здесь — только пояснение.
  .banner
    q-icon.banner__icon(name='info' size='18px')
    .banner__body {{ $t('cooperativeVars.pageIntro') }}

  //- Форма — только когда известно имя кооператива: параметры без него не собираются.
  WindowLoader(v-if='!form', :text='$t("cooperativeVars.loadingText")')
  template(v-else)
    CooperativeVarsFields(v-model='form', extended, :show-errors='showErrors')

  .vars-page__actions(v-if='form')
    BaseButton(variant='primary', :loading='saving', @click='save')
      q-icon(name='save', size='16px')
      span.q-ml-sm {{ $t('cooperativeVars.saveLabel') }}
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { WindowLoader } from 'src/shared/ui/Loader';
import { t } from 'src/shared/i18n';
import {
  CooperativeVarsFields,
  hasMissingRequired,
  toVarsForm,
  useEditCooperativeVars,
  type ICooperativeVarsInput,
} from 'src/features/Cooperative/EditVars';

// Все параметры кооператива, которые фабрика подставляет в документы, —
// председатель видит и правит их здесь (до 20.10.2026 их задавал только мастер
// установки, а после него поправить было нечем).
const systemStore = useSystemStore();
const { save: saveVars } = useEditCooperativeVars();

const coopname = computed(() => systemStore.info?.coopname);
const fromStore = (name: string) => toVarsForm(systemStore.info?.vars as Record<string, any> | undefined, name);
const form = ref<ICooperativeVarsInput | null>(coopname.value ? fromStore(coopname.value) : null);
const saved = ref(JSON.stringify(form.value));
const isDirty = computed(() => JSON.stringify(form.value) !== saved.value);
const saving = ref(false);
const showErrors = ref(false);

// realtime: нет источника на странице — сведения о кооперативе живут по ленте для всего приложения (registerSystemInfoLive). Пришли новые параметры, а на странице правок нет — показываем их; идёт правка — не трогаем.
watch(
  [() => systemStore.info?.vars, coopname],
  () => {
    if (!coopname.value || isDirty.value || saving.value) return;
    form.value = fromStore(coopname.value);
    saved.value = JSON.stringify(form.value);
  },
  { deep: true },
);

const save = async () => {
  if (!form.value || !coopname.value) return;
  if (hasMissingRequired(form.value)) {
    showErrors.value = true;
    FailAlert(t('cooperativeVars.requiredMissing'));
    return;
  }
  saving.value = true;
  try {
    await saveVars(form.value);
    form.value = fromStore(coopname.value);
    saved.value = JSON.stringify(form.value);
    showErrors.value = false;
    SuccessAlert(t('cooperativeVars.savedMessage'));
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped lang="scss">
.vars-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  max-width: 960px;
  @media (max-width: 768px) {
    padding: var(--p-4);
  }
}
.vars-page__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
