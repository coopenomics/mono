<template lang="pug">
div
  ContributorSelector(
    v-model='selectedContributor'
    :project-hash='setMasterInput.project_hash'
    :coopname='setMasterInput.coopname'
    :multi-select='false'
    :dense='dense'
    :loading='loading'
    placeholder=''
    class='master-selector'
    :label='$t("capital.setMasterButton.label")'
    :readonly="!project?.permissions?.can_set_master"
  )
  q-tooltip(
    v-if="!project?.permissions?.can_set_master"
    anchor="top middle"
    self="bottom middle"
  ) {{ $t('capital.setMasterButton.noAccessText') }}
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useSetMaster } from '../model';
import { useContributorStore } from '../../../../entities/Contributor/model';
import { FailAlert } from 'src/shared/api/alerts';
import { ContributorSelector } from '../../../../entities/Contributor';
import type { IProject } from '../../../../entities/Project/model';
import type { IContributor } from '../../../../entities/Contributor/model';
import { useRoute } from 'vue-router';
import { t } from '../../../../i18n';
const currentRoute = useRoute();

interface Props {
  project: IProject | null;
  dense?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  dense: false,
  disable: false,
});

const emit = defineEmits<{
  'master-set': [contributor: IContributor];
}>();

const { setMaster, setMasterInput } = useSetMaster();
const contributorStore = useContributorStore();
const loading = ref(false);
const selectedContributor = ref<IContributor | null>(null);
const currentMaster = ref<IContributor | null>(null);
const isProgrammaticChange = ref(false);

// Загрузка контрибьютора-мастера по username
const loadMaster = async (masterUsername: string) => {
  if (!masterUsername) {
    currentMaster.value = null;
    isProgrammaticChange.value = true;
    selectedContributor.value = null;
    await nextTick();
    isProgrammaticChange.value = false;
    return;
  }

  try {
    // Запрос участника по username (capitalContributor), без списка с пагинацией:
    // раньше вызывали capitalContributors с полями { data: { filter, pagination } } —
    // для Zeus это неверные имена переменных (нужны filter + options на корне),
    // из-за чего на проде приходили первые 10 участников без фильтра, и мастер не находился.
    const foundContributor = await contributorStore.loadContributor({
      username: masterUsername,
    });

    if (foundContributor) {
      currentMaster.value = foundContributor;
      isProgrammaticChange.value = true;
      selectedContributor.value = foundContributor;
      await nextTick();
      isProgrammaticChange.value = false;
    } else {
      console.warn(`Master contributor with username ${masterUsername} not found`);
      currentMaster.value = null;
      isProgrammaticChange.value = true;
      selectedContributor.value = null;
      await nextTick();
      isProgrammaticChange.value = false;
    }
  } catch (error) {
    console.error('Error loading master contributor:', error);
    FailAlert(t('capital.setMasterButton.loadError'));
    currentMaster.value = null;
    isProgrammaticChange.value = true;
    selectedContributor.value = null;
    await nextTick();
    isProgrammaticChange.value = false;
  }
};

// Обновляем входные данные при изменении проекта
// realtime: нет источника — данные приходят свойством от живого родителя и перечитываются здесь по watch.
watch(
  () => props.project,
  async (newProject) => {
    if (newProject) {
      setMasterInput.value.coopname = newProject.coopname || '';
      setMasterInput.value.project_hash = newProject.project_hash;
      // Загружаем контрибьютора-мастера по username
      await loadMaster(newProject.master || '');
    } else {
      // Если проекта нет, очищаем мастера
      await loadMaster('');
    }
  },
  { immediate: true },
);

// Обработчик изменения выбранного контрибьютора
watch(selectedContributor, async (newContributor) => {
  // Игнорируем программные изменения
  if (isProgrammaticChange.value) return;

  // Проверяем права доступа
  if (!props.project?.permissions?.can_set_master) {
    FailAlert(t('capital.setMasterButton.permissionError'));
    selectedContributor.value = currentMaster.value;
    return;
  }

  if (newContributor && !newContributor.username) {
    console.error('SetMasterButton: invalid contributor', newContributor);
    FailAlert(t('capital.setMasterButton.missingUsernameError'));
    selectedContributor.value = null;
    return;
  }

  loading.value = true;

  try {
    // Устанавливаем username выбранного участника как master (или пустую строку при очистке)
    setMasterInput.value.master = newContributor ? newContributor.username : '';
    setMasterInput.value.project_hash = props.project?.project_hash || currentRoute.params.project_hash as string;
    await setMaster(setMasterInput.value);

    emit('master-set', newContributor as IContributor);
  } catch (error) {
    console.error('SetMasterButton: setMaster error', error);
    FailAlert(error);

    // Сбрасываем выбранного участника при ошибке
    selectedContributor.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.master-selector {
  :deep(.q-field) {
    min-width: 200px;
  }
}
</style>
