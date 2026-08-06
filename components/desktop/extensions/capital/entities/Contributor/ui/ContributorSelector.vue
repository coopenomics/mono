<template lang="pug">
q-select(
  ref='selectRef'
  :standout='outlined ? false : "bg-teal text-white"'
  :outlined='outlined'
  :color='outlined ? "primary" : undefined'
  v-model='selectedValue'
  :options='filteredContributors'
  :loading='isSearching || loading'
  :label='label'
  :placeholder='placeholder'
  :multiple='multiSelect'
  :use-chips='multiSelect'
  :use-input='true'
  :fill-input='false'
  :hide-selected='false'
  :stack-label='false'
  :dense='dense'
  :disable='disable'
  :readonly='readonly'
  :clearable='!multiSelect'
  :display-value='displayValue'
  @clear='clearSearch'
  @filter='filterFn'
  @input-value='onInputValue'
  @update:model-value='onModelUpdate'
  input-debounce='300'
  :option-label='optionLabel'
  emit-value
  map-options
  class='contributor-selector'
)
  template(#selected-item='scope' v-if='multiSelect')
    q-chip(
      :key='scope.opt.id'
      :removable='!readonly'
      color='primary'
      text-color='white'
      size='sm'
      @remove='removeContributor(String(scope.opt.id))'
    ) {{ formatContributorName(scope.opt.display_name || scope.opt.username) }}

  template(#option='scope')
    q-item(
      :key='scope.opt.id'
      clickable
      v-bind='scope.itemProps'
    )
      q-item-section(avatar)
        q-avatar(size='sm' color='primary' text-color='white')
          | {{ (scope.opt.display_name || scope.opt.username || '?').charAt(0).toUpperCase() }}
      q-item-section
        .text-body2 {{ scope.opt.display_name || scope.opt.username }}
        .text-caption.text-grey-6 {{ scope.opt.username }}

  template(#no-option)
    q-item
      q-item-section.center
        .text-grey-6.text-center {{ noOptionText }}

  template(#prepend)
    slot(name='prepend')
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useContributorSearch } from './useContributorSearch';
import { formatContributorName } from 'src/shared/lib/utils';
import type { IContributor } from '../model/types';

interface Props {
  modelValue?: IContributor | IContributor[] | null;
  // null допустим: у свободной задачи проекта нет (IIssue.project_hash
  // приходит из GraphQL как string | null). Пустое значение компонент
  // обрабатывает сам — ниже по коду.
  projectHash?: string | null;
  coopname?: string;
  multiSelect?: boolean;
  placeholder?: string;
  label?: string;
  dense?: boolean;
  disable?: boolean;
  readonly?: boolean;
  loading?: boolean;
  /** Канон-вид (как BaseSelect: outlined dense) вместо legacy standout */
  outlined?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: IContributor | IContributor[] | null): void;
  (e: 'contributor-selected', contributor: IContributor): void;
  (e: 'contributors-selected', contributors: IContributor[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  multiSelect: false,
  placeholder: 'Поиск участника...',
  label: 'Участник',
  dense: false,
  disable: false,
  readonly: false,
  loading: false,
  outlined: false,
});

const emit = defineEmits<Emits>();

// Ref для доступа к q-select компоненту
const selectRef = ref();

// Используем composable для поиска
const {
  isSearching,
  selectedContributors,
  filteredContributors,
  filterFn,
  preloadContributors,
  removeContributor: baseRemoveContributor,
  clearSearch: baseClearSearch,
} = useContributorSearch({
  projectHash: props.projectHash ?? undefined,
  coopname: props.coopname,
  multiSelect: props.multiSelect,
});

// Функция для отображения опции
const optionLabel = (contributor: IContributor) => {
  if (!contributor) return '';
  return formatContributorName(contributor.display_name || contributor.username);
};

// Вычисляемое значение для отображения выбранного значения (только для одиночного выбора)
const displayValue = computed(() => {
  if (props.multiSelect) return undefined;
  if (!selectedValue.value || Array.isArray(selectedValue.value)) return '';
  const contributor = selectedValue.value as IContributor;
  return optionLabel(contributor);
});

// Текст для пустого состояния
const noOptionText = ref('Загрузка...');

// Предзагружаем участников
preloadContributors();

// Обновляем текст пустого состояния после завершения предзагрузки
watch([isSearching, filteredContributors], ([searching, contributors]) => {
  if (!searching) {
    if (contributors.length === 0) {
      noOptionText.value = 'Нет участников с допуском';
    } else {
      noOptionText.value = '';
    }
  }
}, { immediate: false });

// Вычисляемое значение для v-model q-select
const selectedValue = computed({
  get: () => {
    if (props.multiSelect) {
      return selectedContributors.value; // возвращаем массив объектов
    } else {
      return selectedContributors.value[0] || null;
    }
  },
  set: (value: any) => {
    if (Array.isArray(value)) {
      selectedContributors.value = value; // value уже массив контрибьюторов
    } else if (value) {
      selectedContributors.value = [value]; // value - контрибьютор
    } else {
      selectedContributors.value = [];
    }

    // Гарантируем, что selectedContributors всегда является массивом
    if (!Array.isArray(selectedContributors.value)) {
      console.warn('ContributorSelector: selectedContributors set to non-array value', selectedContributors.value);
      selectedContributors.value = [];
    }

    emit('update:modelValue', selectedContributors.value.length > 0 ?
      (props.multiSelect ? selectedContributors.value : selectedContributors.value[0]) : null);
  },
});

// Синхронизация с внешним modelValue
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    if (Array.isArray(newValue)) {
      selectedContributors.value = newValue;
    } else {
      selectedContributors.value = [newValue];
    }
  } else {
    selectedContributors.value = [];
  }
}, { immediate: true });

// Обработчики событий
const removeContributor = (contributorId: string) => {
  baseRemoveContributor(contributorId);
  emit('update:modelValue', selectedContributors.value.length > 0 ?
    (props.multiSelect ? selectedContributors.value : selectedContributors.value[0]) : null);

  if (props.multiSelect) {
    emit('contributors-selected', selectedContributors.value);
  }
};

const clearSearch = () => {
  baseClearSearch();
  emit('update:modelValue', null);
};

const onInputValue = (val: string) => {
  if (isSearching.value) {
    noOptionText.value = 'Поиск...';
  } else if (val.length >= 2) {
    noOptionText.value = 'Ничего не найдено';
  }
  // Для коротких запросов (val.length < 2) текст обновляется через watcher
};

const onModelUpdate = (value: any) => {
  // Обработка выбора опции
  if (value && !props.multiSelect) {
    // value - объект контрибьютора
    emit('contributor-selected', value);
  } else if (value && props.multiSelect && Array.isArray(value)) {
    // value - массив объектов контрибьюторов
    emit('contributors-selected', value);
  }

  // Гарантируем корректную обработку значения
  let processedValue = value;
  if (props.multiSelect) {
    if (!Array.isArray(value)) {
      processedValue = value ? [value] : [];
    }
  }

  emit('update:modelValue', processedValue);

  // Закрываем dropdown после выбора, даже в режиме мультиселекта
  selectRef.value?.hidePopup();
};
</script>

<style lang="scss" scoped>
.contributor-selector {
  :deep(.q-field__control) {
    cursor: text;
  }

  :deep(.q-field__native) {
    cursor: text;
  }
}
</style>
