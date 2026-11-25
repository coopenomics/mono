<template lang="pug">
//- Ряд рабочей страницы акта: позиции слева тянутся, сводка справа
//- фиксированной ширины и не уезжает при прокрутке. На узком экране сводка
//- встаёт под позиции. Один ряд — одна задача (акт, бандл выдачи).
.act-ws-row
  .act-ws-row__main
    slot
  aside.act-ws-row__aside
    slot(name='aside')
</template>

<style scoped lang="scss">
.act-ws-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--p-5, 20px);
  align-items: start;

  &__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__aside {
    position: sticky;
    top: var(--p-4, 16px);
  }
}

@media (max-width: 960px) {
  .act-ws-row {
    grid-template-columns: 1fr;

    &__aside {
      position: static;
    }
  }
}
</style>
