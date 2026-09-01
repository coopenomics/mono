<template lang="pug">
q-page
  div.row.justify-center
    div.col-md-10.col-xs-12
      div.q-pa-md
        ProvisionBackButton
        StaticUserAgreement
</template>

<script setup lang="ts">
import { StaticUserAgreement } from 'src/features/Agreementer/StaticUserAgreement';
import { ProvisionBackButton } from 'src/features/Agreementer/ProvisionBackButton';
</script>
