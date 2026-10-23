<template lang="pug">
div.short-invite-widget(
  @click="handleClick"
  :class="{ 'cursor-pointer': clickable }"
)
  Editor(
    :model-value="shortInvite"
    :readonly="true"
    :toolbar="false"
    :placeholder="$t('capital.shortInviteWidget.emptyPlaceholder')"
    class="short-invite-editor"
    :padded="false"
  )

  // Кнопка подробностей
  .q-mt-sm.text-right
    q-btn(
      flat
      dense
      color="primary"
      :label="$t('capital.shortInviteWidget.detailsLabel')"
      @click.stop="handleDetailsClick"
      icon="visibility"
    )
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { Editor } from 'src/shared/ui';

const emit = defineEmits<{
  click: [projectHash: string];
  details: [projectHash: string];
}>();

// Определяем props
const props = defineProps<{
  invite: string;
  projectHash?: string;
  clickable?: boolean;
  maxLength?: number; // Максимальная длина текста в символах
}>();

// Функция для сокращения текста JSON EditorJS
const shortenInvite = (inviteJson: string, maxLength = 200): string => {
  try {
    const data = JSON.parse(inviteJson);
    if (!data.blocks || !Array.isArray(data.blocks)) {
      return inviteJson.length > maxLength
        ? inviteJson.substring(0, maxLength) + '...'
        : inviteJson;
    }

    // Собираем текст из блоков
    let text = '';
    let isTruncated = false;

    for (const block of data.blocks) {
      if (block.type === 'paragraph' && block.data?.text) {
        const blockText = block.data.text.replace(/<[^>]*>/g, ''); // Убираем HTML теги
        if (text.length + blockText.length > maxLength) {
          // Добавляем часть блока
          const remainingLength = maxLength - text.length;
          text += blockText.substring(0, remainingLength) + '...';
          isTruncated = true;
          break;
        }
        text += blockText + '\n';
      }
      // Можно добавить обработку других типов блоков (header, list, etc.)
    }

    // Если текст короткий, возвращаем полный
    if (!isTruncated && text.length <= maxLength) {
      return inviteJson;
    }

    // Создаем сокращенную версию JSON
    return JSON.stringify({
      ...data,
      blocks: [{
        type: 'paragraph',
        data: {
          text: text
        }
      }]
    });

  } catch {
    // Если не JSON, просто обрезаем строку
    return inviteJson.length > maxLength
      ? inviteJson.substring(0, maxLength) + '...'
      : inviteJson;
  }
};

// Вычисляемое свойство для сокращенного инвайта
const shortInvite = computed(() =>
  shortenInvite(props.invite, props.maxLength || 200)
);

// Обработчик клика на виджет
const handleClick = () => {
  if (props.clickable && props.projectHash) {
    emit('click', props.projectHash);
  }
};

// Обработчик клика на кнопку подробностей
const handleDetailsClick = () => {
  if (props.projectHash) {
    emit('details', props.projectHash);
  }
};
</script>

<style lang="scss" scoped>
.short-invite-widget {
  transition: all 0.2s ease;

  &.cursor-pointer:hover {
    .short-invite-editor :deep(.ql-editor) {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
    }
  }

  .short-invite-editor {
    min-height: 80px;

    overflow-y: hidden; // Скрываем прокрутку для сокращенного вида
  }
}
</style>
