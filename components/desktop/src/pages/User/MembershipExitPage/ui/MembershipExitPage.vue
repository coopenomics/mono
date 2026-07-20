<template lang="pug">
.membership-exit-page
  .banner.banner--warn
    q-icon.banner__icon(name='info', size='18px')
    .banner__body
      | Участие в кооперативе добровольное — так же, как вступление, так и выход.
      | Вы вправе прекратить участие, подав заявление; после одобрения Советом
      | паевой взнос возвращается в срок, установленный Уставом.

  BaseCard(title='Как проходит выход')
    ul.exit-points
      li
        q-icon(name='description', size='18px')
        span
          | Выход оформляется вашим заявлением. Система подготовит его автоматически —
          | вам нужно внимательно прочитать текст и подписать простой электронной подписью.
      li
        q-icon(name='mark_email_unread', size='18px')
        span
          | Запуск процедуры подтверждается по ссылке из письма. Совет рассмотрит
          | заявление; до принятия решения доступ к кабинету будет ограничен.
      li
        q-icon(name='payments', size='18px')
        span
          | Паевой взнос вернётся на ваши реквизиты
          | в срок, установленный Уставом кооператива.
      li.exit-points__note
        q-icon(name='block', size='18px')
        span
          | После выхода вернуться к участию нельзя — для возобновления участия
          | потребуется пройти регистрацию заново.

    .membership-exit-page__actions
      ExitButton(
        label='Написать заявление',
        variant='primary',
        icon='edit_note'
      )
</template>

<script setup lang="ts">
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { ExitButton } from 'src/features/Membership/ExitFromCoop';
</script>

<style scoped lang="scss">
.membership-exit-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
}

.exit-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.exit-points li {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}

.exit-points li .q-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--p-ink-3);
}

.exit-points__note {
  color: var(--p-ink-3);
}

.membership-exit-page__actions {
  display: flex;
  justify-content: center;
  padding-top: var(--p-4);
  margin-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}

@media (max-width: 768px) {
  .membership-exit-page {
    padding: var(--p-4);
  }
}
</style>
