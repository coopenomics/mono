<template lang="pug">
StatusPage(
  icon='lock',
  :title='$t("permissionDenied.permissionDenied.title")',
  :body='$t("permissionDenied.permissionDenied.body")'
)
  template(#actions)
    BaseButton(variant='primary', @click='goHome') {{ $t('permissionDenied.permissionDenied.homeButton') }}
</template>

<script lang="ts" setup>
import { BaseButton } from 'src/shared/ui/base';
import { StatusPage } from 'src/shared/ui/domain';
import { useGoHome } from 'src/shared/lib/navigation';
import { setSsrStatus } from 'src/shared/lib/ssr/setSsrStatus';

// Отказ в доступе при серверном рендере уходит честным 403.
setSsrStatus(403);

const goHome = useGoHome();
</script>
