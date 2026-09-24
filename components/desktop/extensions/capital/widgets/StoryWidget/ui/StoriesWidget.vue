<template lang="pug">
div
  //- // Заголовок виджета
  q-card-section.q-pb-sm
    .row.items-center.q-gutter-sm
      //- q-icon(name='history', size='20px')
      //- span.text-bold.full-width.text-center Пользовательские Истории


  // Кнопка добавления артефакта
  q-card-section.q-pa-none.q-mb-md(v-if='canCreate && !showCreateInput')
    q-btn(
      icon='add',
      flat,
      dense,
      color='primary',
      @click='showCreateInput = true'
    )
      | {{ $t('capital.storiesWidget.addButton') }}

  // Форма создания истории
  q-card-section.q-pa-none.q-mb-md(v-if='canCreate && showCreateInput')
    q-input.q-pa-sm(
      ref='titleInput',
      v-model='newStoryTitle',
      :placeholder='$t("capital.storiesWidget.titlePlaceholder")',
      dense,
      flat,
      hide-bottom-space,
      @keydown.enter='handleCreateStory',
      @keydown.escape='handleCancelCreate',
      type='textarea',
      rows='1'
    )
      template(#prepend)
        q-btn(
          icon='close',
          flat,
          dense,
          color='grey',
          @click='handleCancelCreate'
        )
      template(#append)
        q-btn(
          icon='check',
          flat,
          dense,
          color='positive',
          @click='handleCreateStory',
          :loading='creating'
        )

  // Список историй
  q-card-section.q-pa-none
    .stories-list
      q-item(
        v-for='story in stories?.items || []',
        :key='story._id',
        clickable,
        v-ripple,
        @click='onStoryClick(story)'
      )
        q-item-section(side)
          q-checkbox(
            :model-value='story.status',
            :true-value='Zeus.StoryStatus.COMPLETED',
            :false-value='Zeus.StoryStatus.PENDING',
            dense,
            @update:model-value='handleStatusChange(story, $event)',
            @click.stop,
            color='positive'
          )

        q-item-section
          .text-body2.font-weight-medium {{ story.title }}
            //- .full-width
            //-   // Индикатор типа истории
            //-   q-badge(
            //-     :color='getStoryTypeColor(story)',
            //-     :label='getStoryTypeLabel(story)'
            //-   )


        q-item-section(side)
          DeleteStoryButton(
            :story-hash='story.story_hash',
            :story-title='story.title',
            @deleted='onStoryDeleted',
            @close='onDeleteDialogClose',
            @click.stop
          )

      // Заглушка если нет историй
      div(v-if='!loading && (!stories?.items || stories.items.length === 0)')
        .text-center.q-pa-md
          .text-body2.text-grey-6.q-mt-sm
            | {{ emptyMessage }}

      // Загрузка
      div(v-if='loading')
        .text-center.q-pa-md
          q-spinner(color='primary', size='24px')
          .text-body2.text-grey-6.q-mt-sm {{ $t('capital.storiesWidget.loadingText') }}
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CAPITAL_LIVE_TABLES } from 'app/extensions/capital/shared/lib/live';
import { Zeus } from '@coopenomics/sdk';
import {
  useStoryStore,
  type IStory,
  type IGetStoriesInput,
  type ICreateStoryInput,
  type IUpdateStoryInput,
} from 'app/extensions/capital/entities/Story/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useCreateStory } from 'app/extensions/capital/features/Story/CreateStory';
import { DeleteStoryButton } from 'app/extensions/capital/features/Story/DeleteStory';
import { useUpdateStory } from 'app/extensions/capital/features/Story/UpdateStory';
import { t } from '../../../i18n';

// Props для конфигурации виджета
interface Props {
  // Фильтр для загрузки историй
  filter?: Partial<IGetStoriesInput['filter']>;
  // Показывать ли кнопку создания
  canCreate?: boolean;
  // Максимальное количество историй для отображения
  maxItems?: number;
  // Сообщение когда нет историй
  emptyMessage?: string;
  // Callback при клике на историю
  onStoryClick?: (story: IStory) => void | undefined;
  // Callback при клике на задачу
  onIssueClick?: (issueId: string) => void | undefined;
  // Хэш текущего открытого проекта
  currentProjectHash?: string;
}

const props = withDefaults(defineProps<Props>(), {
  canCreate: true,
  maxItems: 50,
  emptyMessage: t('capital.storiesWidget.emptyTitle'),
  onStoryClick: undefined,
  onIssueClick: undefined,
  currentProjectHash: undefined,
});

const { info } = useSystemStore();
const sessionStore = useSessionStore();
const storyStore = useStoryStore();

// Реактивные переменные
const loading = ref(false);
const creating = ref(false);
const newStoryTitle = ref('');
const titleInput = ref();
const updatingStoryId = ref<string | null>(null);
const showCreateInput = ref(false);

// Вычисляемые свойства
const stories = computed(() => {
  if (!storyStore.stories) return null;

  // Сортируем истории: сперва проектные без issue, затем остальные
  const sortedItems = [...storyStore.stories.items].sort((a, b) => {
    // Определяем приоритет группы для каждой истории
    const getGroupPriority = (story: IStory): number => {
      if (story.project_hash && !story.issue_hash) {
        // Проектная история без issue - высший приоритет (группа 1)
        return 1;
      }
      // Все остальные истории (группа 2)
      return 2;
    };

    const aPriority = getGroupPriority(a);
    const bPriority = getGroupPriority(b);

    // Если приоритеты разные - сортируем по приоритету
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Если приоритеты одинаковые - сортируем по sort_order, затем по _created_at
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return 0;
  });

  // Ограничиваем количество элементов если указано maxItems
  if (props.maxItems && sortedItems.length > props.maxItems) {
    return {
      ...storyStore.stories,
      items: sortedItems.slice(0, props.maxItems),
    };
  }

  return {
    ...storyStore.stories,
    items: sortedItems,
  };
});

// Загрузка историй
const loadStories = async () => {
  loading.value = true;
  try {
    const filter: IGetStoriesInput['filter'] = {
      coopname: info.coopname,
      ...props.filter,
    };

    const options: IGetStoriesInput['options'] = {
      page: 1,
      limit: props.maxItems,
      sortBy: '_created_at',
      sortOrder: 'DESC',
    };

    await storyStore.loadStories({ filter, options });
  } catch (error) {
    console.error('Ошибка при загрузке историй:', error);
    FailAlert(t('capital.storiesWidget.loadError'));
  } finally {
    loading.value = false;
  }
};

// Создание истории
const handleCreateStory = async () => {
  if (!newStoryTitle.value.trim()) return;
  if (!sessionStore.username || sessionStore.username === '') {
    FailAlert(t('capital.storiesWidget.authRequiredNotice'));
    return;
  }

  creating.value = true;
  try {
    // Подготавливаем данные для создания истории
    const currentUsername = sessionStore.username;
    if (!currentUsername) {
      throw new Error('Username is required');
    }

    const storyData = {
      title: newStoryTitle.value.trim(),
      content_format: Zeus.CapitalStoryContentFormat.MARKDOWN,
      ...props.filter, // Добавляем фильтр (project_hash или issue_hash)
    } as ICreateStoryInput;

    const newStory = await useCreateStory().createStory(storyData);
    SuccessAlert(t('capital.storiesWidget.createdNotice'));

    // Добавляем новую историю в локальный store
    storyStore.addStoryToList(newStory);

    // Сбрасываем форму
    newStoryTitle.value = '';
  } catch (error) {
    console.error('Ошибка при создании истории:', error);
    FailAlert(t('capital.storiesWidget.createError'));
  } finally {
    creating.value = false;
  }
};

// Отмена создания истории
const handleCancelCreate = () => {
  newStoryTitle.value = '';
  showCreateInput.value = false;
};

// // Функция для получения цвета бейджа типа истории
// const getStoryTypeColor = (story: IStory): string => {
//   if (story.project_hash && !story.issue_hash) {
//     return 'blue'; // Проектная история
//   }
//   if (story.issue_hash) {
//     return 'orange'; // Задачная история
//   }
//   return 'grey'; // Обычная история
// };


// // Функция для получения текста бейджа типа истории
// const getStoryTypeLabel = (story: IStory): string => {
//   if (story.project_hash && !story.issue_hash) {
//     return 'проект'; // Проектная история
//   }
//   if (story.issue_hash) {
//     // Для задачной истории берем первые 6 символов issue_hash
//     const shortId = story.issue_hash.substring(0, 6);
//     return `задача #${shortId}`;
//   }
//   return 'история'; // Обычная история
// };

// Обработчик клика по истории
const onStoryClick = (story: IStory) => {
  // Если у истории есть issue_hash - переходим к задаче
  if (story.issue_hash && props.onIssueClick) {
    props.onIssueClick(story.issue_hash);
    return;
  }

  // Если у истории есть project_hash и это текущий открытый проект - ничего не делаем
  if (story.project_hash && story.project_hash === props.currentProjectHash) {
    return;
  }

  // В остальных случаях вызываем стандартный обработчик
  if (props.onStoryClick) {
    props.onStoryClick(story);
  }
};

// Обработчики для DeleteStoryButton
const onStoryDeleted = () => {
  // История будет автоматически удалена из списка через store
};

const onDeleteDialogClose = () => {
  // Обработка закрытия диалога
};

// Изменение статуса истории
const handleStatusChange = async (
  story: IStory,
  newStatus: Zeus.StoryStatus,
) => {
  updatingStoryId.value = story._id;
  try {
    const updateData: IUpdateStoryInput = {
      story_hash: story.story_hash,
      status: newStatus,
      content_format:
        story.content_format ?? Zeus.CapitalStoryContentFormat.MARKDOWN,
    };

    // Обновляем историю через API
    await useUpdateStory().updateStory(updateData);

    SuccessAlert(t('capital.storiesWidget.statusUpdatedNotice'));
  } catch (error) {
    console.error('Ошибка при обновлении статуса артефакта:', error);
    FailAlert(t('capital.storiesWidget.statusUpdateError'));
  } finally {
    updatingStoryId.value = null;
  }
};

// Инициализация
// Виджет живёт по ленте изменений Благороста.
useLiveReload(CAPITAL_LIVE_TABLES, () => loadStories());

onMounted(async () => {
  await loadStories();
});
</script>

<style lang="scss" scoped>
.stories-list {
  .q-item {
    border-radius: 8px;
    margin-bottom: 4px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
  }
}

.text-h6 {
  margin-bottom: 8px;
}

// Стили для бейджей типов историй
.q-badge {
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 8px;
}
</style>
