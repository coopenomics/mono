<template lang="pug">
.monitor-page
  //- Предупреждение об исчерпании квот — баннером на всю ширину сверху.
  BaseBanner.monitor-page__alert(variant="warn")
    template(#icon)
      q-icon(name="warning", size="20px")
    | Не допускайте исчерпание квот ресурсов — это заблокирует обработку новых документов в кооперативе.

  //- Верхний ряд: слева (2/3) «как это работает», справа (1/3) кошелёк AXON.
  //- На узком экране перестраивается в одну колонку: сначала описание, затем кошелёк.
  .monitor-page__top
    .monitor-page__info
      ResourceInfoWidget
    .monitor-page__wallet
      AxonWalletCard

  //- Ресурсы в одну строку (CPU / NET / RAM); на узком экране — в колонку.
  .monitor-page__resources
    CpuResourceWidget
    NetResourceWidget
    RamResourceWidget
</template>

<script lang="ts" setup>
import { BaseBanner } from 'src/shared/ui/base/BaseBanner'
import CpuResourceWidget from '../../../widgets/CpuResourceWidget'
import NetResourceWidget from '../../../widgets/NetResourceWidget'
import RamResourceWidget from '../../../widgets/RamResourceWidget'
import ResourceInfoWidget from '../../../widgets/ResourceInfoWidget'
import AxonWalletCard from '../../../widgets/AxonWalletCard'
</script>

<style lang="scss" scoped>
.monitor-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  padding: var(--p-6, 24px);
  max-width: 1200px;
  margin: 0 auto;
}

.monitor-page__alert {
  width: 100%;
}

.monitor-page__top {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--p-5, 20px);
  align-items: stretch;
}

.monitor-page__resources {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--p-5, 20px);
  align-items: stretch;
}

@media (max-width: 1024px) {
  .monitor-page__top,
  .monitor-page__resources {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .monitor-page {
    padding: var(--p-4, 16px);
  }
}
</style>
