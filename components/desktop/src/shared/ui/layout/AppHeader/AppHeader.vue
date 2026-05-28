<template lang="pug">
header.topbar(role='banner')
  //- Бургер слева (canon HTML: [≡] crumb · · · действия │ глобальные)
  button.icon-btn(
    v-if='showMenuButton',
    type='button',
    aria-label='Меню',
    @click="emit('toggle-menu')"
  )
    q-icon(name='menu')

  //- Бренд: логотип + название (используется на экранах без авторизации,
  //- когда нет иерархии страниц и нет крошки). Опциональный slot —
  //- если страница его не заполняет, ничего не рендерится.
  .topbar__brand(v-if='hasBrand')
    slot(name='brand')

  //- Крошка: либо одиночный `<b>title</b>`, либо breadcrumb с chevron'ами
  .topbar__crumb(v-if='!hasBrand')
    slot(name='crumb')
      template(v-if='breadcrumbs && breadcrumbs.length')
        template(v-for='(crumb, idx) in breadcrumbs', :key='idx')
          component(
            :is="crumb.route ? 'router-link' : 'span'",
            :to='crumb.route'
          )
            template(v-if='idx === breadcrumbs.length - 1')
              b {{ crumb.label }}
            template(v-else) {{ crumb.label }}
          q-icon(
            v-if='idx < breadcrumbs.length - 1',
            name='chevron_right'
          )
      template(v-else-if='title')
        b {{ title }}

  //- Page-scoped действия: CTA + overflow.
  //- Слот, чтобы страница сама вкладывала свой набор.
  .topbar__actions(v-if='hasActions')
    slot(name='actions')

  //- Глобальные действия справа: уведомления, тема, профиль.
  //- Mini-wallet СПЕЦИАЛЬНО НЕ ПРИСУТСТВУЕТ — баланс пайщика отображается
  //- в RailUserCard (нижняя часть AppDrawer); в правой части шапки только
  //- глобальные действия.
  .topbar__right(v-if='hasRight')
    slot(name='right')
      slot(name='notifications')
      slot(name='theme')
      slot(name='profile')
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { AppHeaderProps } from './AppHeader.types';

withDefaults(defineProps<AppHeaderProps>(), {
  showMenuButton: true,
});

const emit = defineEmits<{
  'toggle-menu': [];
}>();

const slots = useSlots();
const hasBrand = computed(() => !!slots.brand);
const hasActions = computed(() => !!slots.actions);
const hasRight = computed(
  () => !!(slots.right || slots.notifications || slots.theme || slots.profile),
);
</script>
