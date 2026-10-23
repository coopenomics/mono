<template lang="pug">
q-page
  div.row.justify-center
    div.col-md-10.col-xs-12
      div.q-pa-md
        ProvisionBackButton
        StaticPrivacyPolicy
</template>

<script setup lang="ts">
import { StaticPrivacyPolicy } from 'src/features/Agreementer/StaticPrivacyPolicy';
import { ProvisionBackButton } from 'src/features/Agreementer/ProvisionBackButton';
</script>
