<template lang="pug">
div
q-card(flat).q-pa-md
  p.text-h6 {{ $t('user.logoutCard.title') }}
  div.q-pa-sm
    span {{ $t('user.logoutCard.hint') }}
  q-btn(size="sm" color="primary" @click="logout").q-mt-md
    q-icon( color="white" name="logout")
    span.q-ml-sm {{ $t('user.logoutCard.submit') }}

</template>
<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { useLogoutUser } from 'src/features/User/Logout/model'
import { FailAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';

const router = useRouter()

const logout = async () => {
  const { logout } = useLogoutUser()

  try {
    await logout()
    router.push({ name: 'signin' })

  } catch (e: any) {
    FailAlert(t('user.logoutCard.errorPrefix') + e.message)
  }
}

</script>
