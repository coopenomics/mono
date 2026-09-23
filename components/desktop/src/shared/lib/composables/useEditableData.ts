import { ref, watch } from 'vue';
import isEqual from 'lodash/isEqual';
import { t } from 'src/shared/i18n';

export function useEditableData<T extends Record<string, any>>(
  initialData: T,
  onSaveCallback: (updatedData: T) => void,
  formRef?: { value: any } // Опциональная ссылка на форму
) {
  const originalData = ref(JSON.parse(JSON.stringify(initialData))); // Оригинальные данные
  const editableData = ref(JSON.parse(JSON.stringify(initialData))); // Локальная копия данных
  const isEditing = ref(false); // Флаг редактирования
  const isDisabled = ref(false); // Флаг блокировки действий

  // Проверка валидности формы
  const validateForm = async () => {
    if (formRef?.value) {
      const valid = await formRef.value.validate();
      isDisabled.value = valid === false; // Блокируем действия, только если форма невалидна
    }
  };

  // Автоматически отслеживаем изменения в editableData
  watch(
    editableData,
    (newData) => {
      isEditing.value = !isEqual(newData.value, originalData.value); // Глубокое сравнение объектов
      validateForm(); // Проверка валидности формы при изменении данных
    },
    { deep: true, immediate: true }
  );

  const saveChanges = async () => {
    if (isDisabled.value) {
      throw new Error(t('composables.error.formInvalid'));
    }
    originalData.value = JSON.parse(JSON.stringify(editableData.value));
    onSaveCallback(editableData.value as T); // Передаем данные в коллбек
    isEditing.value = false; // Завершаем редактирование
  };

  const cancelChanges = () => {
    editableData.value = JSON.parse(JSON.stringify(originalData.value));
    isEditing.value = false; // Завершаем редактирование
  };

  // Проверяем форму сразу при инициализации, если есть ссылка
  if (formRef?.value) {
    validateForm();
  }

  return {
    editableData,
    isEditing,
    isDisabled,
    saveChanges,
    cancelChanges,
  };
}
