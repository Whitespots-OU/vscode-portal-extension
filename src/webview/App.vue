<template>
  <RouterView />
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue'

const value = ref('')

onMounted(() => {
  value.value = 'Test'
})
</script>