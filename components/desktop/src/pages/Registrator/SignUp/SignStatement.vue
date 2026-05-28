<template lang="pug">
div
  q-step(
    :name='store.steps.SignStatement',
    title='Подпишите заявление на вступление',
    :done='store.isStepDone("SignStatement")'
  )
    div(v-if='onSign')
      Loader(:text='loadingText')

    div(v-else)
      // Контейнер, внутри которого класс Canvas создаёт <canvas>
      .signature-container(
        v-if='!onSign',
        ref='around'
        :class='{ "signature-started": signatureStarted }'
      )
        p.signature-hint Оставьте собственноручную подпись в рамке
      .row.q-gutter-md.q-mt-lg.q-mb-lg
        BaseButton(variant='ghost', @click='store.prev()')
          i.fa.fa-arrow-left
          span.q-ml-md назад

        BaseButton(variant='ghost', @click='clearCanvas') очистить

        BaseButton(variant='primary', @click='setSignature') Продолжить
</template>

<script lang="ts" setup>
import { ref, onBeforeUnmount, watch, nextTick } from 'vue';
import { FailAlert } from 'src/shared/api';
import { Loader } from 'src/shared/ui/Loader';
import { useRegistratorStore } from 'src/entities/Registrator';
import { useCreateUser } from 'src/features/User/CreateUser';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

// Импортируем класс
import { Classes } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

const store = useRegistratorStore();
const createUser = useCreateUser();

const around = ref<HTMLElement | null>(null);
const onSign = ref(false);
const loadingText = ref('');
const signatureStarted = ref(false);

// Экземпляр Canvas
let canvasClass: Classes.Canvas | null = null;

/**
 * Инициализация Canvas с задержкой
 */
const initCanvas = () => {
  // Ждём 200ms, чтобы Quasar завершил рендеринг
  setTimeout(() => {
    if (around.value) {
      canvasClass = new Classes.Canvas(around.value, {
        lineWidth: 5,
        strokeStyle: getComputedStyle(document.documentElement).getPropertyValue('--q-primary').trim() || '#1976d2',
      });

      // Добавляем обработчик первого взаимодействия
      const canvas = canvasClass.canvas;
      const startSignature = () => {
        signatureStarted.value = true;
        canvas.removeEventListener('mousedown', startSignature);
        canvas.removeEventListener('touchstart', startSignature);
      };

      canvas.addEventListener('mousedown', startSignature);
      canvas.addEventListener('touchstart', startSignature);
    }
  }, 200);
};

/**
 * Следим за текущим шагом
 * Используем immediate: true вместо отдельного onMounted
 */
watch(
  () => store.state.step,
  (newStep) => {
    if (newStep === store.steps.SignStatement) {
      signatureStarted.value = false;
      nextTick(() => initCanvas());
    }
  },
  { immediate: true }
);

/**
 * При размонтировании снимаем слушатели
 */
onBeforeUnmount(() => {
  canvasClass?.destroy();
});

/**
 * Очистка холста
 */
const clearCanvas = () => {
  canvasClass?.clearCanvas();
  signatureStarted.value = false;

  // Переустанавливаем обработчики событий после очистки
  if (canvasClass?.canvas) {
    const canvas = canvasClass.canvas;
    const startSignature = () => {
      signatureStarted.value = true;
      canvas.removeEventListener('mousedown', startSignature);
      canvas.removeEventListener('touchstart', startSignature);
    };

    canvas.addEventListener('mousedown', startSignature);
    canvas.addEventListener('touchstart', startSignature);
  }
};

/**
 * Получение подписи + проверка пустоты
 */
const setSignature = async () => {
  if (!canvasClass) {
    FailAlert('Пожалуйста, оставьте собственноручную подпись в окне');
    return;
  }

  const sign = canvasClass.getSignature();
  // Проверим, есть ли хоть один ненулевой пиксель
  const ctx = canvasClass.ctx;
  const { width, height } = canvasClass.canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const isEmpty = !data.some((channel) => channel !== 0);

  if (!sign || isEmpty) {
    FailAlert('Пожалуйста, оставьте собственноручную подпись в окне');
    return;
  }

  try {
    onSign.value = true;
    store.state.signature = sign;

    // устанавливаем ключ для подписи документов
    client.Document.setWif(store.state.account.private_key);

    // Подписываем все документы регистрации динамически
    await createUser.signAllRegistrationDocuments((msg) => {
      loadingText.value = msg;
    });

    loadingText.value = 'Подписываем заявление';
    await createUser.signStatement();

    // Отправка
    await createUser.sendStatementAndAgreements();

    loadingText.value = '';
    onSign.value = false;
    store.next();
  } catch (err: any) {
    onSign.value = false;
    FailAlert(err);
  }
};
</script>

<style scoped>
/* Canon-вариант контейнера подписи: dashed-рамка по canon-линии,
   surface-2 фон, никаких glow/shadow и hover-ужесточения. */
.signature-container {
  min-height: 220px;
  padding: var(--p-4, 16px);
  border: 1px dashed var(--p-line-2, var(--p-line));
  border-radius: var(--p-radius-lg, 12px);
  background: var(--p-canvas-2, var(--p-canvas));
  position: relative;
  transition: border-color 0.2s ease;
}

.signature-container:hover {
  border-color: var(--p-primary);
}

/* Подсказка-метка по центру, спокойный canon-fill.
   Pointer-events отключены — клики идут на canvas сквозь подсказку. */
.signature-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  text-align: center;
  pointer-events: none;
  user-select: none;
  transition: opacity 0.25s ease;
}

/* После начала подписи подсказка исчезает плавно. */
.signature-container.signature-started .signature-hint {
  opacity: 0;
}
</style>
