<template lang="pug">
ContributorSelector(
  v-model='selectedCreators'
  :multi-select='true'
  :dense='dense'
  :disable='disable'
  :loading='loading'
  :project-hash='issue?.project_hash'
  :readonly='!(props.permissions)?.can_assign_creator'
  placeholder=''
  class='creators-selector'
  :label='$t("capital.setCreatorButton.label")'
  style="width: 220px;"
)
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useSetCreators } from '../model';
import { useContributorStore } from '../../../../entities/Contributor/model';
import { FailAlert } from 'src/shared/api/alerts';
import { ContributorSelector } from '../../../../entities/Contributor';
import type { IIssue, IIssuePermissions } from '../../../../entities/Issue/model';
import type { IContributor } from '../../../../entities/Contributor/model';
import { t } from '../../../../i18n';

interface Props {
  issue: IIssue;
  dense?: boolean;
  disable?: boolean;
  permissions?: IIssuePermissions | null;
}

const props = withDefaults(defineProps<Props>(), {
  dense: false,
  disable: false,
  permissions: undefined,
});

const emit = defineEmits<{
  'creators-set': [creators: IContributor[]];
  'issue-updated': [issue: IIssue];
}>();

const { setCreators, setCreatorsInput } = useSetCreators();
const contributorStore = useContributorStore();
const loading = ref(false);
const selectedCreators = ref<IContributor[]>([]);
const currentCreators = ref<IContributor[]>([]);
const isSaving = ref(false);
const isLoadingCreators = ref(false);
const isProgrammaticChange = ref(false);

// Загрузка контрибьюторов по их usernames
const loadCreators = async (creatorUsernames: string[]) => {
  isLoadingCreators.value = true;
  isProgrammaticChange.value = true;
  try {
    if (!creatorUsernames || creatorUsernames.length === 0) {
      currentCreators.value = [];
      selectedCreators.value = [];
      await nextTick();
      isProgrammaticChange.value = false;
      return;
    }
    // Загружаем каждого контрибьютора отдельно
    const creators = await Promise.all(
      creatorUsernames.map(async (username) => {
        try {
          return await contributorStore.loadContributor({ username });
        } catch (error) {
          console.error(`Failed to load contributor ${username}:`, error);
          return null;
        }
      })
    );

    // Фильтруем null значения и устанавливаем текущих создателей
    currentCreators.value = creators.filter((creator): creator is IContributor => creator !== null);
    selectedCreators.value = [...currentCreators.value];
    await nextTick();
  } catch (error) {
    console.error('Error loading creators:', error);
    FailAlert(t('capital.setCreatorButton.loadError'));
    currentCreators.value = [];
    selectedCreators.value = [];
    await nextTick();
  } finally {
    isProgrammaticChange.value = false;
    isLoadingCreators.value = false;
  }
};

// Обновляем входные данные при изменении задачи
watch(
  () => props.issue,
  async (newIssue) => {
    if (newIssue) {
      setCreatorsInput.value.issue_hash = newIssue.issue_hash;
      // Загружаем контрибьюторов по их usernames
      await loadCreators(newIssue.creators || []);
    } else {
      // Если задачи нет, очищаем создателей
      await loadCreators([]);
    }
  },
  { immediate: true },
);

// Автоматическое сохранение при изменении выбранных создателей
watch(selectedCreators, async (newCreators, oldCreators) => {
  // Игнорируем программные изменения
  if (isProgrammaticChange.value) return;

  // Игнорируем изменения во время загрузки создателей
  if (isLoadingCreators.value) return;

  // Предотвращаем повторное сохранение
  if (isSaving.value) return;

  // Преобразуем null в пустой массив
  const normalizedNewCreators = Array.isArray(newCreators) ? newCreators : [];
  const normalizedOldCreators = Array.isArray(oldCreators) ? oldCreators : [];

  // Проверяем права доступа (только если permissions загружено)
  if (props.permissions && !(props.permissions.can_assign_creator)) {
    // Если данные не изменились, просто выходим без ошибки
    const newUsernames = normalizedNewCreators.map(c => c?.username).filter(Boolean).sort();
    const currentUsernames = currentCreators.value.map(c => c?.username).filter(Boolean).sort();
    if (JSON.stringify(newUsernames) === JSON.stringify(currentUsernames)) {
      return;
    }

    FailAlert(t('capital.setCreatorButton.forbiddenError'));
    // Восстанавливаем предыдущее состояние при отсутствии прав
    isProgrammaticChange.value = true;
    selectedCreators.value = [...normalizedOldCreators];
    await nextTick();
    isProgrammaticChange.value = false;
    return;
  }

  // Проверяем, что у всех выбранных участников есть username
  const invalidContributors = normalizedNewCreators.filter(c => !c?.username);
  if (invalidContributors.length > 0) {
    console.error('SetCreatorButton: invalid contributors', invalidContributors);
    FailAlert(t('capital.setCreatorButton.missingUsernameError'));
    return;
  }

  // Проверяем, изменились ли данные по сравнению с ТЕКУЩИМИ создателями (а не старыми из watcher)
  const newUsernames = normalizedNewCreators
    .map(c => c?.username)
    .filter(Boolean)
    .sort();
  const currentUsernames = currentCreators.value
    .map(c => c?.username)
    .filter(Boolean)
    .sort();

  const usernamesChanged = JSON.stringify(newUsernames) !== JSON.stringify(currentUsernames);

  if (!usernamesChanged) {
    // Данные не изменились по сравнению с currentCreators, не сохраняем
    return;
  }

  isSaving.value = true;
  loading.value = true;

  try {
    // Создаем копию объекта для передачи в API
    const inputData = {
      issue_hash: setCreatorsInput.value.issue_hash,
      creators: normalizedNewCreators
        .map((c: IContributor) => c?.username)
        .filter((username): username is string => username !== undefined && username !== null),
    };

    const updatedIssue = await setCreators(inputData, props.issue);

    // Обновляем currentCreators после успешного сохранения
    currentCreators.value = [...normalizedNewCreators];

    // Эмитируем обновленную задачу для обновления родительского компонента
    emit('issue-updated', updatedIssue);

    emit('creators-set', normalizedNewCreators);
  } catch (error) {
    console.error('SetCreatorButton: setCreators error', error);
    FailAlert(error);

    // При ошибке восстанавливаем selectedCreators к предыдущему состоянию
    isProgrammaticChange.value = true;
    selectedCreators.value = [...normalizedOldCreators];
    await nextTick();
    isProgrammaticChange.value = false;
  } finally {
    loading.value = false;
    isSaving.value = false;
  }
}, { deep: true });

</script>

<style lang="scss" scoped>
.creators-selector {
  :deep(.q-field) {
    min-width: 250px;
  }
}
</style>
