<template lang="pug">
BaseCard(
  title='Выход из кооператива',
  subtitle='Прекращение участия с возвратом паевого взноса.'
)
  .exit-danger
    p.exit-danger__hint
      | Действие необратимо: после одобрения Советом участие прекращается, а для
      | возобновления потребуется пройти регистрацию заново.
    .exit-danger__actions
      BaseButton(variant='danger', @click='infoOpen = true')
        template(#icon-left)
          q-icon(name='group_remove', size='18px')
        | Выйти из кооператива

  //- Шаг 1: как проходит выход (бывшая отдельная страница, свёрнута в диалог).
  //- Шаг 2 — заявление и подпись — открывает ExitButton своим диалогом поверх.
  BaseDialog(v-model='infoOpen', title='Как проходит выход', size='md')
    .exit-danger__info
      BaseBanner(variant='warn')
        | Участие в кооперативе добровольное — так же, как вступление, так и выход.
        | Вы вправе прекратить участие, подав заявление; после одобрения Советом
        | паевой взнос возвращается в срок, установленный Уставом.

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

    template(#footer)
      BaseButton(variant='secondary', @click='infoOpen = false') Отмена
      ExitButton(
        label='Написать заявление',
        variant='danger',
        icon='edit_note'
      )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard, BaseDialog } from 'src/shared/ui/base';
import ExitButton from './ExitButton.vue';

const infoOpen = ref(false);
</script>

<style scoped lang="scss">
.exit-danger {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.exit-danger__hint {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.exit-danger__actions {
  display: flex;
}
.exit-danger__info {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
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
</style>
