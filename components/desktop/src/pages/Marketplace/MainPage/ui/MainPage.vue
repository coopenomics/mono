<template lang="pug">
div
  //- q-tabs(v-if="loggedIn" dense switch-indicator inline-label outside-arrows mobile-arrows align="justify" active-class="bg-teal-2" )
  //-   q-route-tab(name="Витрина" label="Витрина" :to="{name: 'marketplace-showcase'}" )
  //-   q-route-tab(name="Мои объявления" label="Мои объявления" :to="{name: 'marketplace-user-offers'}" )
  //-   q-route-tab(name="Мои заказы" label="Мои заказы" :to="{name: 'marketplace-user-supplies'}" )
  //-   q-route-tab(name="Создать объявление" label="Создать объявление" :to="{name: 'marketplace-create-offer'}" )
  //-   q-route-tab(name="Все объявления" label="Все объявления" :to="{name: 'marketplace-moderation'}" )
  //-   q-route-tab(name="Все заказы" label="Все заказы" :to="{name: 'marketplace-supplies'}" )

  router-view

</template>

<script setup lang="ts">
// import { computed } from 'vue'
// import { useSessionStore } from 'src/entities/Session'
// const session = useSessionStore()

// const loggedIn = computed(() => {
//   return session.isAuth
// })
</script>

