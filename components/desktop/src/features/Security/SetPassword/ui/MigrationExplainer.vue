<template lang="pug">
//- Объяснение перехода «ключ → пароль»: иконка-герб + пункты с пользой для
//- пайщика. Один текст на оба контекста миграции — оверлей в активной сессии
//- и обязательный шаг при входе по ключу, — чтобы история не расходилась.
.migration-explainer
  .migration-explainer__hero
    q-icon(name='verified_user', size='28px')
  p.migration-explainer__lead
    | Кооператив переходит на новую систему идентификации —
    | цифровое удостоверение пайщика.
  ul.migration-explainer__points
    li
      q-icon(name='lock', size='18px')
      span
        | Для защиты ваших средств, документов и персональных данных
        | рекомендуем установить пароль: вход в систему будет по email и паролю.
    li
      q-icon(name='key_off', size='18px')
      span
        | Ключ доступа, выданный при регистрации, после установки пароля
        | больше не потребуется.
    li
      q-icon(name='schedule', size='18px')
      span(v-if='inSession')
        | Установка займёт меньше минуты — выходить из системы не придётся.
      span(v-else)
        | Установка займёт меньше минуты — после неё вы сразу войдёте в кабинет.
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  /** true — пайщик уже в кабинете (оверлей); false — шаг на форме входа. */
  inSession?: boolean;
}>(), {
  inSession: true,
});
</script>

<style scoped>
.migration-explainer {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

/* Иконка-«герб» удостоверения: мягкий круг в акцентном тоне, по центру. */
.migration-explainer__hero {
  align-self: center;
  width: 56px;
  height: 56px;
  border-radius: var(--p-r-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-soft);
  color: var(--p-primary);
}

.migration-explainer__lead {
  margin: 0;
  text-align: center;
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
  font-weight: 600;
  color: var(--p-ink);
}

.migration-explainer__points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.migration-explainer__points li {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.migration-explainer__points li .q-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--p-ink-3);
}
</style>
