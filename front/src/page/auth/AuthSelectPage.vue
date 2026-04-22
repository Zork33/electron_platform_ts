<template>
  <div class="auth-select-container">
    <div class="logo-section">
      <img src="~assets/logo.png" alt="Logo" class="logo-image" />
    </div>

    <div class="text-center q-mb-md">
      <div class="auth-title">Electron</div>
    </div>

    <div class="auth-options">
      <q-btn
        unelevated
        color="secondary"
        size="lg"
        class="auth-btn"
        @click="goToLogin"
      >
        <q-icon name="login" class="q-mr-sm" />
        Войти
      </q-btn>

      <q-btn
        outline
        color="secondary"
        size="lg"
        class="auth-btn"
        @click="goToRegister"
      >
        Зарегистрироваться
      </q-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToLogin = () => {
  router.push('/auth/login').catch(() => {
    // Ignore navigation errors
  })
}

const goToRegister = () => {
  router.push('/auth/register').catch(() => {
    // Ignore navigation errors  
  })
}
</script>

<style lang="scss" scoped>
.auth-select-container {
  max-width: 320px;
  margin: 0 auto;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 70vh;
}

.logo-section {
  text-align: center;
}

.logo-image {
  height: 240px;
  object-fit: contain;
  margin-bottom: 1rem;
  border-radius: 16px;
}

.auth-title {
  margin: 0 0 0.5rem 0;
  font-weight: 300;
  font-size: 3.5rem;
}

.auth-subtitle {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.auth-options {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }
}

.auth-btn {
  width: 100%;
  text-transform: none;
  font-weight: 500;
  border-radius: 50px !important;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--q-secondary-rgb), 0.3);
  }
}

@media (max-width: 600px) {
  .auth-select-container {
    padding: 1.5rem 1rem;
    min-height: 60vh;
  }

  .logo-image {
    width: 90px;
    height: 90px;
  }

  .auth-options {
    padding: 1rem;
  }
}
</style>
