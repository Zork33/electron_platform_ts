<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container class="auth-container">
      <!-- Dark mode toggle in top right corner -->
      <div class="theme-toggle-container">
        <DarkModeToggle />
      </div>

      <div class="auth-center-wrapper">
        <div class="col-12">
          <div class="auth-content">
            <!-- Навигация назад к выбору -->
            <div v-if="showBackButton" class="text-center q-mb-md">
              <q-btn
                flat
                round
                icon="arrow_back"
                color="grey-7"
                no-caps
                @click="goToAuthSelect"
                class="back-button"
              />
            </div>

            <!-- Динамический контент страниц авторизации -->
            <transition
              name="auth-page"
              mode="out-in"
            >
              <router-view />
            </transition>
          </div>
        </div>
      </div>

    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DarkModeToggle from '../shared/ui/DarkModeToggle.vue'

const route = useRoute()
const router = useRouter()

const showBackButton = computed(() => route.name === 'login')

const goToAuthSelect = () => {
  router.push('/auth').catch(() => {
    // Ignore navigation errors
  })
}
</script>

<style lang="scss">
.auth-container {
  position: relative;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.auth-center-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
}

.theme-toggle-container {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;
}

.auth-content {
  padding: 2rem 1rem;
}

.q-btn {
  text-transform: none;
  font-weight: 500;
  border-radius: 50px !important; // Round buttons
}

.back-button {
  border-radius: 50px !important;
}

@media (max-width: 600px) {
  .auth-content {
    padding: 1rem;
  }

  .theme-toggle-container {
    top: 0.5rem;
    right: 0.5rem;
  }
}

// Dark theme background
body.body--dark .auth-container {
  background-color: var(--q-bg-page, #1a1f27);
}

// Custom page transition animations as fallback
.auth-page-enter-active,
.auth-page-leave-active {
  transition: all 0.3s ease;
}

.auth-page-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.auth-page-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.auth-page-enter-to,
.auth-page-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
