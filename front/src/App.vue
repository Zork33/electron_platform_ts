<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuth } from './shared/composable/useAuth'

const { initAuth } = useAuth()

// Инициализация авторизации при старте приложения
// Если есть валидный токен — загружает данные пользователя
onMounted(async () => {
  await initAuth()
})
</script>
