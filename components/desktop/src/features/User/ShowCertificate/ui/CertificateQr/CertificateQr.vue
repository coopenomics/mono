<template lang="pug">
.cert-qr(:style='{ width: `${size}px`, height: `${size}px` }')
  img.cert-qr__img(v-if='src', :src='src', alt='Код удостоверения пайщика')
  .cert-qr__fallback(v-else-if='error') {{ error }}
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import QRCode from 'qrcode';

/**
 * Код удостоверения пайщика. Само удостоверение из приложения не выходит: код
 * рисуется здесь и живёт только на экране — предъявить его можно, забрать файлом
 * нельзя. Это осознанный отказ от выгрузки: удостоверение несёт персональные данные,
 * и файл, однажды покинувший приложение, дальше ходит сам по себе.
 */
const props = withDefaults(defineProps<{ jws: string; size?: number }>(), {
  size: 132,
});

const src = ref('');
const error = ref('');

watchEffect(async () => {
  src.value = '';
  error.value = '';
  if (!props.jws) return;
  try {
    src.value = await QRCode.toDataURL(props.jws, {
      // Наименьшая избыточность: с её ростом падает вместимость, а код читают с
      // экрана — терять там нечего.
      errorCorrectionLevel: 'L',
      margin: 0,
      // Рисуем с запасом по точкам и ужимаем стилями: так код остаётся резким и на
      // ретине, и при разворачивании на весь экран.
      scale: 10,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch {
    error.value = 'Удостоверение не помещается в код';
  }
});
</script>

<style scoped>
.cert-qr {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Код читается только на светлом фоне — рамка держит его белым в тёмной теме. */
  background: #ffffff;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  padding: var(--p-2);
  flex: none;
}
.cert-qr__img {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
}
.cert-qr__fallback {
  font-size: var(--p-fs-body-sm);
  color: var(--p-neg);
  text-align: center;
}
</style>
