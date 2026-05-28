<template lang="pug">
.wallet-page
  WalletProgramWidget
  ConvertToBillingDialog

  //- Действия страницы в шапке — через canon Teleport в слот-host шапки.
  //- defer: target (#header-actions-host) живёт в layout-шапке, смонтированной
  //- раньше страницы. На мобильном — micro-вариант кнопок (иконка + tooltip),
  //- чтобы не раздувать узкую шапку; на десктопе — полные кнопки с подписью.
  //- Сами кнопки решают свою видимость (DepositButton скрыт, пока пайщик
  //- не принят — status !== 'active').
  Teleport(to='#header-actions-host', defer)
    DepositButton(:micro='isMobile')
    WithdrawButton(:micro='isMobile')
    ConvertToBillingButton(:micro='isMobile')
</template>

<script lang="ts" setup>
import { WalletProgramWidget } from 'src/widgets/Wallet';
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import { WithdrawButton } from 'src/features/Wallet/WithdrawFromWallet';
import { ConvertToBillingButton, ConvertToBillingDialog } from 'src/features/Billing/ConvertToBilling';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();
</script>

<style lang="scss" scoped>
.wallet-page {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .wallet-page {
    padding: var(--p-4, 16px);
  }
}
</style>
