<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseButton } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  loadSupplierProfile,
  updateCooperativeProfile,
  type MarketplaceSupplierProfileView,
} from 'src/entities/MarketplaceSupplierProfile';
import { SupplierProfileForm } from 'src/widgets/Marketplace/SupplierProfileForm';

/**
 * Профиль кооператива на столе администратора. Кооператив — поставщик
 * имущества со своего склада: заказчик открывает этот профиль с карточек
 * «со склада».
 */
const route = useRoute();
const router = useRouter();

const coopname = computed(() => String(route.params.coopname ?? ''));
const profile = ref<MarketplaceSupplierProfileView | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

async function load(): Promise<void> {
  loading.value = true;
  try {
    profile.value = await loadSupplierProfile(coopname.value);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onSaved(saved: MarketplaceSupplierProfileView): void {
  profile.value = saved;
}

function openProfile(): void {
  void router.push({
    name: 'marketplace-admin-supplier-profile',
    params: { coopname: coopname.value, account: coopname.value },
  });
}

// Профиль может править другой администратор — форма подхватывает его правку.
useLiveReload(marketLiveTables('supplier'), () => {
  if (!loading.value) void load();
});

onMounted(load);
</script>

<template lang="pug">
q-page.coop-profile(role="region", :aria-label="$t('marketplace.coopProfilePage.ariaLabel')")
  PageHint(storage-key="mp:coop-profile:banner-dismissed")
    | {{ $t('marketplace.coopProfilePage.hint') }}

  q-skeleton(v-if="firstLoad", type="rect", height="320px")

  SupplierProfileForm(v-else, :profile="profile", :save="updateCooperativeProfile", @saved="onSaved")
    template(#actions)
      BaseButton(variant="secondary", @click="openProfile")
        template(#icon-left)
          q-icon(name="visibility", size="16px")
        | {{ $t('marketplace.coopProfilePage.openProfileAction') }}
</template>

<style scoped lang="scss">
.coop-profile {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  max-width: 880px;
}

@media (max-width: 768px) {
  .coop-profile {
    padding: var(--p-4);
  }
}
</style>
