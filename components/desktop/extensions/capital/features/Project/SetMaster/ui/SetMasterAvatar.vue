<template lang="pug">
.set-master-avatar(@click.stop)
  //- Триггер: аватарка мастера (или плейсхолдер «назначить»).
  //- По клику открывается q-menu с ContributorSelector — мастер один,
  //- поэтому выбор одиночный (без мульти-выбора).
  .master-trigger(
    :class='{ readonly: !canSet, empty: !currentMaster && !isLoadingMaster }'
  )
    //- Пока мастер грузится — скелетон-кружок, а не «мастер не назначен»:
    //- пустой плейсхолдер во время загрузки вводит в заблуждение
    template(v-if='isLoadingMaster && !currentMaster')
      .skel.skel--circle.avatar-skel
    template(v-else-if='currentMaster')
      .master-avatar
        span.master-initial {{ masterInitial }}
        q-tooltip(anchor='bottom middle', self='top middle') Мастер: {{ currentMaster.display_name || currentMaster.username }}
    template(v-else)
      q-icon.empty-icon(name='manage_accounts', size='18px', color='grey-6')
      q-tooltip(v-if='canSet', anchor='bottom middle', self='top middle') Назначить мастера

    q-menu(
      v-if='canSet'
      anchor='bottom right'
      self='top right'
      :offset='[0, 4]'
    )
      .selector-popup
        ContributorSelector(
          v-model='selectedMaster'
          :multi-select='false'
          :dense='true'
          :loading='loading'
          :project-hash='project?.project_hash'
          placeholder='поиск...'
          label='Мастер'
          autofocus
        )
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useSetMaster } from '../model';
import { useContributorStore } from '../../../../entities/Contributor/model';
import { FailAlert } from 'src/shared/api/alerts';
import { ContributorSelector } from '../../../../entities/Contributor';
import type { IProject, IProjectComponent } from '../../../../entities/Project/model';
import type { IContributor } from '../../../../entities/Contributor/model';

interface Props {
  project: IProject | IProjectComponent;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'master-set': [contributor: IContributor | null];
}>();

const { setMaster, setMasterInput } = useSetMaster();
const contributorStore = useContributorStore();

const loading = ref(false);
const selectedMaster = ref<IContributor | null>(null);
const currentMaster = ref<IContributor | null>(null);
const isSaving = ref(false);
const isLoadingMaster = ref(false);
const isProgrammaticChange = ref(false);

const canSet = computed(() => !!props.project?.permissions?.can_set_master);

const masterInitial = computed(() => {
  const src =
    currentMaster.value?.display_name || currentMaster.value?.username || '?';
  return src.charAt(0).toUpperCase();
});

const loadMaster = async (masterUsername: string) => {
  isProgrammaticChange.value = true;
  isLoadingMaster.value = true;
  try {
    if (!masterUsername) {
      currentMaster.value = null;
      selectedMaster.value = null;
      return;
    }
    const contributor = await contributorStore.loadContributor({
      username: masterUsername,
    });
    currentMaster.value = contributor ?? null;
    selectedMaster.value = contributor ?? null;
  } catch (error) {
    console.error('SetMasterAvatar: load master failed', error);
    currentMaster.value = null;
    selectedMaster.value = null;
  } finally {
    await nextTick();
    isProgrammaticChange.value = false;
    isLoadingMaster.value = false;
  }
};

watch(
  () => props.project,
  async (newProject) => {
    if (newProject) {
      setMasterInput.value.project_hash = newProject.project_hash;
      await loadMaster(newProject.master || '');
    } else {
      await loadMaster('');
    }
  },
  { immediate: true },
);

watch(selectedMaster, async (newMaster, oldMaster) => {
  if (isProgrammaticChange.value) return;
  if (isSaving.value) return;

  if (!canSet.value) {
    FailAlert('У вас нет прав на изменение мастера');
    isProgrammaticChange.value = true;
    selectedMaster.value = oldMaster ?? null;
    await nextTick();
    isProgrammaticChange.value = false;
    return;
  }

  if ((newMaster?.username || '') === (currentMaster.value?.username || ''))
    return;

  isSaving.value = true;
  loading.value = true;
  try {
    await setMaster({
      coopname: setMasterInput.value.coopname,
      project_hash: props.project.project_hash,
      master: newMaster?.username || '',
    });
    currentMaster.value = newMaster ?? null;
    emit('master-set', newMaster ?? null);
  } catch (error) {
    console.error('SetMasterAvatar: setMaster error', error);
    FailAlert(error);
    isProgrammaticChange.value = true;
    selectedMaster.value = oldMaster ?? null;
    await nextTick();
    isProgrammaticChange.value = false;
  } finally {
    loading.value = false;
    isSaving.value = false;
  }
});
</script>

<style lang="scss" scoped>
.set-master-avatar {
  display: inline-flex;
  align-items: center;
}

// Та же геометрия, что у аватарок исполнителей задач (SetCreatorAvatars):
// колонка не прыгает между строками с мастером и без.
.master-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  box-sizing: border-box;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--p-r-md);
  transition: background-color 0.15s ease;

  &:hover:not(.readonly) {
    background-color: var(--p-surface-2);
  }

  &.readonly {
    cursor: default;
  }

  &.empty {
    padding: 4px 9px 4px 4px; // 4 + (28 − 18) / 2 — центр иконки в центре колонки аватара
  }
}

// Скелетон на время загрузки мастера — той же геометрии, что аватар
.avatar-skel {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

// margin-left: auto — жёсткая прижимка вправо независимо от justify-content
.empty-icon {
  margin-left: auto;
}

.master-avatar {
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--p-primary);
  color: #fff;
  border: 2px solid var(--p-surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.master-initial {
  display: block;
  line-height: 1;
  margin-top: 1px; // оптическая центровка под cap-height шрифта
}

.selector-popup {
  padding: var(--p-3);
  min-width: 260px;
  max-width: 320px;
}
</style>
