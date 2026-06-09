<template>
  <q-page padding>
    <div class="q-pa-md">
      <div class="text-h5 q-mb-md">Опубликовать релиз</div>
      <q-banner class="bg-info text-white q-mb-md" rounded>
        Заглушка (Epic 9 story 9.3). Здесь будет форма выбора tarball'а
        и POST на ca-admin /v1/admin/releases с подписью chairman'а.
      </q-banner>
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle2">Шаги публикации</div>
          <ol class="text-body2 q-mt-md">
            <li>Выбрать пакет из списка «Мои пакеты».</li>
            <li>Загрузить tarball на Nexus (через ca-auth presigned PUT).</li>
            <li>Отправить manifest + sha256 → POST /v1/admin/releases.</li>
            <li>Подписать setrelease через chairman key (двух-сиг).</li>
          </ol>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Заглушка для V1.
</script>
