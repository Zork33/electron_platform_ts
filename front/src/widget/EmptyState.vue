<template>
  <div class="empty-state text-center q-pa-xl">
    <q-icon name="inbox" size="4em" color="grey-5" class="q-mb-md" />
    <div class="text-h6 q-mb-sm">{{ title }}</div>
    <div class="text-body2 text-grey-7">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()
</script>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
</style>