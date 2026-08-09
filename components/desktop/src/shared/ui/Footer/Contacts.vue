<template lang='pug'>
.contact-footer.q-pa-xs.text-center
  .contact-footer__text(v-if='text') {{ text }}
  .contact-footer__links
    router-link.contact-footer__link(to='/privacy') Политика конфиденциальности
    span.contact-footer__sep ·
    router-link.contact-footer__link(to='/terms') Пользовательское соглашение
</template>

<script setup lang='ts'>
defineProps({
  text: {
    type: String,
    required: false,
    default: '',
  },
});
</script>

<style scoped>
.contact-footer {
  font-size: 12px;
  color: var(--p-ink-2);
}

.contact-footer__text {
  margin-bottom: var(--p-1);
}

.contact-footer__links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--p-1);
}

.contact-footer__link {
  color: var(--p-ink-2);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.contact-footer__link:hover {
  color: var(--p-ink);
}

.contact-footer__sep {
  color: var(--p-ink-3);
}
</style>
