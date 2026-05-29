<template lang="pug">
.q-pa-md
  .row
    .col-md-12.col-xs-12
      q-card.cooperative-card(flat, round, style='border-radius: 20px')
        .q-pa-sm.row.items-center.q-pa-md
          .col-12.col-md-3.flex.justify-center
            AutoAvatar(
              style='width: 60px; border-radius: 50%',
              :username='session.username'
            )
          .col-12.col-md-9.q-mt-sm.q-mt-md-0
            q-badge(
              color='primary',
              style='font-size: 12px; margin-bottom: 4px'
            ) {{ role }}
            .text-h6
              span.q-mr-sm(v-if='isIP') ИП
              | {{ displayName }}
        .row
          DepositButton.col-6.border-left-radius-buttons
          WithdrawButton.col-6.border-right-radius-buttons

          .col-md-4.col-xs-12

      q-list.q-gutter-sm(flat)
        q-item
          q-item-section
            q-item-label(caption) Имя аккаунта
            q-item-label.text-bold(style='font-size: 20px') {{ session.username }}

        //- q-item
        //-   q-item-section
        //-     q-item-label(caption) Паевый счёт
        //-     q-item-label(style="font-size: 20px;").text-bold {{ walletStore.wallet.available }}

        q-item
          q-item-section
            q-item-label(caption) Минимальный паевый счёт
            q-item-label.text-bold(style='font-size: 20px') {{ session.participantAccount?.minimum_amount }}

        q-item(
          v-for='program_wallet of walletStore.program_wallets',
          :key='program_wallet.id'
        )
          q-item-section
            q-item-label(caption) {{ program_wallet.program_details.title }}

            q-item-label.text-bold(style='font-size: 20px') {{ program_wallet.available }}

    //- div.col-md-6.col-xs-12.q-mt-lg
</template>

<script lang="ts" setup>
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import { WithdrawButton } from 'src/features/Wallet/WithdrawFromWallet';
import { AutoAvatar } from 'src/shared/ui/domain/AutoAvatar';
import { useWalletStore } from 'src/entities/Wallet';
import { useSessionStore } from 'src/entities/Session';
const walletStore = useWalletStore();
const session = useSessionStore();

import { computed } from 'vue';

const userType = computed(() => session.privateAccount?.type);

const isIP = computed(
  () => session.privateAccount?.type === 'entrepreneur',
);

const role = computed(() => {
  if (session.isChairman) return 'Председатель совета';
  else if (session.isMember) return 'Член совета';
  else return 'Пайщик';
});

const individualProfile = computed(() => {
  if (userType.value === 'individual') {
    return session.privateAccount?.individual_data;
  }
  return null;
});

const entrepreneurProfile = computed(() => {
  if (userType.value === 'entrepreneur') {
    return session.privateAccount?.entrepreneur_data;
  }
  return null;
});

const organizationProfile = computed(() => {
  if (userType.value === 'organization') {
    return session.privateAccount?.organization_data;
  }
  return null;
});

// const userProfile = computed(() => {
//   if (userType.value === 'individual' || userType.value === 'entrepreneur') {
//     return individualProfile?.value || entrepreneurProfile?.value
//   }
//   return organizationProfile?.value
// })

const displayName = computed(() => {
  if (userType.value === 'individual') {
    return `${individualProfile.value?.last_name} ${individualProfile.value?.first_name} ${individualProfile.value?.middle_name}`;
  } else if (userType.value === 'entrepreneur') {
    return `${entrepreneurProfile.value?.last_name} ${entrepreneurProfile.value?.first_name} ${entrepreneurProfile.value?.middle_name}`;
  } else {
    return organizationProfile.value?.short_name;
  }
});

// const inn_ogrn = computed(() => {
//   if (organizationProfile.value)
//     return `${organizationProfile.value.details.inn} / ${organizationProfile.value.details.ogrn}`
//   else return ''
// })
</script>
<style lang="scss" scoped>
.cooperative-card {
  max-width: 400px;
  width: 100%;
}

.border-left-radius-buttons {
  border-top-left-radius: 0px !important;
  border-top-right-radius: 0px !important;
  border-bottom-right-radius: 0px !important;
  border-bottom-left-radius: 20px !important;
}

.border-right-radius-buttons {
  border-top-right-radius: 0px !important;
  border-top-left-radius: 0px !important;
  border-bottom-right-radius: 20px !important;
  border-bottom-left-radius: 0px !important;
}
</style>
