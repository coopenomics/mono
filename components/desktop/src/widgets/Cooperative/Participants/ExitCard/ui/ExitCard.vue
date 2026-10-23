<template lang="pug">
q-card(flat bordered).q-pa-md
  span.text-h6  {{ $t('cooperative.exitCard.title') }}
  div
    span {{ $t('cooperative.exitCard.description') }}
  q-btn(color="red" @click="exit").q-mt-md
    q-icon( color="white" name="send")
    span.q-ml-sm {{ $t('cooperative.exitCard.submitLabel') }}
</template>
<script lang="ts" setup>

const exit = () => {
  console.log('on exit')
}
</script>
