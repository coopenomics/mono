<template lang="pug">
q-select(
  :label='label',
  v-model='selectedUser',
  :options='selectOptions',
  :option-value='(item) => item?.data?.username',
  :option-label='(item) => (item ? getDisplayName(item) : "")',
  use-input,
  hide-selected,
  fill-input,
  input-debounce='300',
  emit-value,
  map-options,
  clearable,
  :standout='standout',
  :filled='filled',
  :outlined='outlined',
  :dense='dense',
  :color='color',
  @filter='onFilter',
  @update:model-value='onUpdate',
  :loading='loading',
  :rules='rules',
  :key='`user-select-${selectedUser}`'
)
  template(v-slot:option='scope')
    q-item(v-bind='scope.itemProps')
      q-item-section(avatar)
        q-avatar(
          text-color='white',
          :icon='getTypeIcon(scope.opt.type)',
          size='sm',
          :color='getTypeColor(scope.opt.type)'
        )
      q-item-section
        q-item-label(style='font-weight: bold') {{ getDisplayName(scope.opt) }}
        q-item-label(caption) {{ getUsernameFromData(scope.opt) }}
        q-item-label(caption, v-if='getAdditionalInfo(scope.opt)') {{ getAdditionalInfo(scope.opt) }}

  template(v-slot:selected-item)
    div(v-if='selectedUser')
      // Если есть полные данные пользователя
      div(v-if='selectedUserObject')
        q-avatar(
          text-color='white',
          :icon='getTypeIcon(selectedUserObject.type)',
          size='sm',
          :color='getTypeColor(selectedUserObject.type)'
        )
      // Fallback - показываем только username
      div(v-else)
        q-avatar(text-color='white', icon='person', size='sm', color='grey')
        span.q-ml-sm {{ selectedUser }}

  template(v-slot:no-option)
    q-item
      q-item-section.text-grey
        | {{ searchQuery ? 'Ничего не найдено' : 'Начните вводить для поиска' }}
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useUserSearch } from './composables/useUserSearch';
import type { UserSearchResult } from './model/types';

// Пропсы компонента
const props = defineProps<{
  modelValue?: string;
  label?: string;
  rules?: ((val: string) => boolean | string)[];
  dense?: boolean;
  standout?: boolean | string;
  filled?: boolean;
  outlined?: boolean;
  color?: string;
  /** Ограничить выдачу типами аккаунтов (например, только физлица: ['individual']). */
  types?: string[];
}>();

// Эмиты
const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void;
}>();

// Композабл для поиска пользователей
const { searchResults, loading, searchUsers } = useUserSearch();

// Локальное состояние
const selectedUser = ref<string | undefined>(props.modelValue);
const searchQuery = ref('');
const selectedUserData = ref<UserSearchResult | null>(null);

// Отладка при монтировании
onMounted(() => {
  // console.log('UserSearchSelector mounted');
  // console.log('searchResults:', searchResults.value);
  // console.log('loading:', loading.value);
  // console.log('searchUsers function:', typeof searchUsers);
});

// Следим за изменениями modelValue
watch(
  () => props.modelValue,
  (newVal) => {
    // console.log('modelValue changed to:', newVal); // Отладка
    selectedUser.value = newVal;
    // Очищаем сохраненные данные при изменении извне
    if (!newVal) {
      selectedUserData.value = null;
    }
  },
);

// Следим за изменениями selectedUser для отладки
watch(selectedUser, (newVal, oldVal) => {
  // console.log('selectedUser changed from:', oldVal, 'to:', newVal);
  if (oldVal && !newVal) {
    // console.warn('selectedUser was cleared! Stack trace:');
    // console.trace();
  }
});

// Вычисляемые свойства
const label = computed(() => props.label || 'Выберите пользователя');

// Опции для select - всегда включаем выбранного пользователя
const selectOptions = computed(() => {
  // console.log('Computing selectOptions...'); // Отладка
  // console.log('searchResults.value:', searchResults.value); // Отладка
  // console.log('selectedUserData.value:', selectedUserData.value); // Отладка

  const allowed = props.types;
  const options = searchResults.value.filter(
    (r) => !allowed?.length || allowed.includes(r.type),
  );

  // Если есть выбранный пользователь, но его нет в результатах поиска, добавляем
  if (selectedUserData.value) {
    const isAlreadyInOptions = options.some(
      (option) =>
        option.data.username === selectedUserData.value?.data.username,
    );
    // console.log('Selected user already in options:', isAlreadyInOptions); // Отладка
    if (!isAlreadyInOptions) {
      options.unshift(selectedUserData.value);
      // console.log('Added selected user to options'); // Отладка
    }
  }

  // console.log('Final select options:', options); // Отладка
  return options;
});

// Находим объект выбранного пользователя для отображения
const selectedUserObject = computed(() => {
  // console.log('Computing selectedUserObject...'); // Отладка
  // console.log('selectedUser.value:', selectedUser.value); // Отладка
  // console.log('selectedUserData.value:', selectedUserData.value); // Отладка

  // Сначала пробуем использовать сохраненные данные
  if (
    selectedUserData.value &&
    selectedUserData.value.data.username === selectedUser.value
  ) {
    // console.log('Using saved user data'); // Отладка
    return selectedUserData.value;
  }

  // Если нет сохраненных данных, ищем в опциях select
  if (!selectedUser.value) {
    // console.log('No selected user'); // Отладка
    return null;
  }

  const found = selectOptions.value.find(
    (result) => result.data.username === selectedUser.value,
  );
  // console.log('Found in select options:', found); // Отладка
  return found || null;
});

// Методы для отображения
const getDisplayName = (user: UserSearchResult | null | undefined): string => {
  if (!user || !user.data) return '';

  try {
    switch (user.type) {
      case 'individual':
      case 'entrepreneur': {
        const data = user.data as any;
        return (
          `${data.last_name || ''} ${data.first_name || ''} ${data.middle_name || ''}`.trim() ||
          data.username ||
          ''
        );
      }
      case 'organization': {
        const data = user.data as any;
        return data.short_name || data.full_name || data.username || '';
      }
      default:
        return user.data?.username || '';
    }
  } catch {
    // console.error('Error in getDisplayName:', error, user);
    return user.data?.username || '';
  }
};

const getUsernameFromData = (
  user: UserSearchResult | null | undefined,
): string => {
  return user?.data?.username || '';
};

const getAdditionalInfo = (
  user: UserSearchResult | null | undefined,
): string => {
  if (!user || !user.data) return '';

  try {
    switch (user.type) {
      case 'entrepreneur': {
        const data = user.data as any;
        return `ИП • ИНН: ${data.details?.inn || 'н/д'}`;
      }
      case 'organization': {
        const data = user.data as any;
        return `Организация • ИНН: ${data.details?.inn || 'н/д'}`;
      }
      default:
        return '';
    }
  } catch {
    // console.error('Error in getAdditionalInfo:', error, user);
    return '';
  }
};

const getTypeIcon = (type: string | undefined): string => {
  switch (type) {
    case 'individual':
      return 'person';
    case 'entrepreneur':
      return 'business';
    case 'organization':
      return 'corporate_fare';
    default:
      return 'person';
  }
};

const getTypeColor = (type: string | undefined): string => {
  switch (type) {
    case 'individual':
      return 'blue';
    case 'entrepreneur':
      return 'green';
    case 'organization':
      return 'purple';
    default:
      return 'grey';
  }
};

// Обработчики событий
const onFilter = (
  val: string,
  update: (fn: () => void) => void,
  abort: () => void,
) => {
  // console.log('onFilter called with:', val); // Отладка
  searchQuery.value = val;

  if (val.length >= 1) {
    searchUsers(val)
      .then(() => {
        update(() => {
          return;
        });
      })
      .catch(() => {
        abort();
      });
  } else {
    if (selectedUserData.value) {
      searchResults.value = [selectedUserData.value];
    } else {
      searchResults.value = [];
    }
    update(() => {
      // console.log('Update callback for short query called'); // Отладка
    });
  }
};

const onUpdate = (value: UserSearchResult | string | undefined) => {
  // console.log('onUpdate called with:', value, 'type:', typeof value); // Отладка

  // Если передан объект результата поиска, извлекаем username и сохраняем данные
  let username: string | undefined;
  if (typeof value === 'string') {
    username = value;
    // console.log('String value received:', username); // Отладка

    // При передаче строки пытаемся найти соответствующий объект в опциях
    const foundUser = selectOptions.value.find(
      (result) => result.data.username === value,
    );
    // console.log('Found user for string:', foundUser); // Отладка

    if (foundUser) {
      selectedUserData.value = foundUser;
    }
  } else if (value && typeof value === 'object' && 'data' in value) {
    username = value.data.username;
    selectedUserData.value = value; // Сохраняем полные данные пользователя
  } else {
    username = undefined;
    selectedUserData.value = null;
  }

  selectedUser.value = username;
  emit('update:modelValue', username);
};
</script>

<style scoped>
:deep(mark) {
  background-color: #ffeb3b;
  padding: 0;
}
</style>
