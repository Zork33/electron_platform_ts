<template>
  <div class="dark-mode-toggle">
    <q-toggle
      v-model="darkMode"
      checked-icon="brightness_2"
      unchecked-icon="wb_sunny"
      color="primary"
      size="md"
    />
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar'
import { ref, watch, onMounted } from 'vue'

const $q = useQuasar()
const darkMode = ref(localStorage.getItem('isDarkMode') === 'true')

onMounted(() => {
  $q.dark.set(darkMode.value)
})

watch(darkMode, (val) => {
  $q.dark.set(val)
  localStorage.setItem('isDarkMode', val.toString())
})
</script>

<style lang="scss" scoped>
.dark-mode-toggle {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5rem;
}

.q-toggle {
  margin: 0;
}
</style>
