<template>
  <div class="py-20 text-center">
    <h1 class="mb-4 text-lg font-semibold">
      Unable to authorize in LLM service
    </h1>
    <p v-if="url">
      Please chack your permissions and service availability in the <WLink
        :href="`${url}global-settings/llm`"
        target="_blank"
        text="Portal LLM Settings"
      />
    </p>

    <div class="mt-8 flex justify-center">
      <WButton
        :semantic-type="SemanticType.PRIMARY"
        :loading="loading"
        @click="retry"
      >
        Retry
      </WButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {onBeforeMount, ref} from 'vue'

import {SemanticType} from 'eco-vue-js/dist/utils/SemanticType'

import WButton from 'eco-vue-js/dist/components/Button/WButton.vue'
import WLink from 'eco-vue-js/dist/components/Link/WLink.vue'

import {tokenRefresh} from '@/webview/api/ApiClient'
import {apiWebview} from '@/webview/api/ApiWebview'

const url = ref<string>()
const loading = ref(false)

const retry = () => {
  if (loading.value) return

  loading.value = true

  tokenRefresh()
    .finally(() => {
      loading.value = false
    })
}

onBeforeMount(async () => {
  const settings = await apiWebview.getSettings()
  url.value = settings.base.url
})
</script>