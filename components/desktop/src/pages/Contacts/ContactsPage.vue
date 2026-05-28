<template lang="pug">
.contacts-page
  header.contacts-page__header
    span.contacts-page__eyebrow Контактные данные
    h1.contacts-page__title {{ contacts?.full_name || 'Организация' }}

  .contacts-card
    //- Реквизиты и председатель — единая сетка полей.
    .contacts-grid
      .field
        span.field__label ИНН
        span.field__value {{ displayValue(contacts?.details?.inn) }}
      .field
        span.field__label ОГРН
        span.field__value {{ displayValue(contacts?.details?.ogrn) }}
      .field(v-if='chairman')
        span.field__label Председатель совета
        span.field__value {{ chairman }}

    //- Контакты — те же поля, значения-ссылки, без иконок и заголовка.
    .contacts-grid.contacts-grid--contacts
      .field(v-if='contacts?.phone')
        span.field__label Телефон
        a.field__value.field__value--link(:href='`tel:${phoneHref}`') {{ contacts.phone }}
      .field(v-if='contacts?.email')
        span.field__label Email
        a.field__value.field__value--link(:href='`mailto:${contacts.email}`') {{ contacts.email }}
      .field.field--wide(v-if='contacts?.full_address')
        span.field__label Адрес
        span.field__value {{ contacts.full_address }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';

const { info } = useSystemStore();

const contacts = computed(() => info.contacts);

const chairman = computed(() => {
  const chair = contacts.value?.chairman;
  if (!chair) {
    return '';
  }
  return [chair.last_name, chair.first_name, chair.middle_name]
    .filter(Boolean)
    .join(' ');
});

const phoneHref = computed(() =>
  (contacts.value?.phone || '').replace(/\s+/g, ''),
);

const displayValue = (value?: string | null) => value || '—';
</script>

<style lang="scss" scoped>
/* Полная ширина, как на canon-страницах документов/платежей. */
.contacts-page {
  padding: var(--p-6, 24px);
}
@media (max-width: 768px) {
  .contacts-page {
    padding: var(--p-4, 16px);
  }
}

.contacts-page__header {
  display: grid;
  gap: var(--p-1, 4px);
  margin-bottom: var(--p-5, 20px);
}
.contacts-page__eyebrow {
  font-size: var(--p-fs-eyebrow, 11px);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
.contacts-page__title {
  margin: 0;
  font-size: var(--p-fs-h1, 24px);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--p-ink);
}

/* Единая спокойная поверхность; одна линия делит реквизиты и контакты. */
.contacts-card {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  padding: var(--p-5, 20px);
}

.contacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--p-4, 16px) var(--p-6, 24px);
}
.contacts-grid--contacts {
  margin-top: var(--p-5, 20px);
  padding-top: var(--p-5, 20px);
  border-top: 1px solid var(--p-line);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  min-width: 0;
}
.field--wide {
  grid-column: 1 / -1;
}
.field__label {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
.field__value {
  font-size: var(--p-fs-body, 14px);
  font-weight: 500;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
}
a.field__value--link {
  color: var(--p-primary);
  text-decoration: none;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
a.field__value--link:hover {
  color: var(--p-primary-hover);
  text-decoration: underline;
}
</style>
