<template lang="pug">
q-card(flat bordered).q-pa-md.q-mt-lg
  q-card-section
    div.full-width.text-center
      q-badge(color="teal").q-pa-sm
        q-icon(name="fa-solid fa-check" size="48px")
      div(class="text-h5").q-mt-md {{ $t('registrator.alreadyRegistered.title') }}

  q-card-actions(align="center")
    q-btn(:label="$t('registrator.alreadyRegistered.homeButton')" color="primary" icon="fa fa-arrow-left" @click="goBack")
  </template>
<script lang="ts" setup>
import { useRouter } from 'vue-router'
const router = useRouter()

function goBack() {
  router.push({ name: 'index' });
}
</script>