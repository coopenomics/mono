<template lang="pug">
//- Оболочка стола «Приложения»: разделы (Каталог / Установленные / Подписки)
//- называет вертикальное меню стола, второго меню на странице нет
//- (решение владельца 26.10.2026). Страница приложения живёт под той же
//- оболочкой со своей кнопкой «Назад».
.catalog-shell
  .catalog-shell__content
    router-view
  //- Кошелёк членских взносов у оператора — в шапке всех страниц стола
  //- (28.11.2026): подписки оплачиваются из него, остаток виден сразу.
  Teleport(to='#header-actions-host', defer)
    OperatorWalletButton
</template>

<script lang="ts" setup>
import { OperatorWalletButton } from 'src/widgets/CatalogApp';
</script>

<style scoped lang="scss">
.catalog-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.catalog-shell__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>
