<template>
  <div class="login-container" @click="clearErrors">
    <div class="logo-section">
      <img src="~assets/logo.png" alt="Logo" class="logo-image" />
    </div>

    <div class="text-center q-mb-md">
      <div class="auth-title">Вход</div>

      <!-- Step indicator -->
      <div class="step-indicator">
        <div class="step-dot" :class="{ active: step === 1 }">1</div>
        <div class="step-line"></div>
        <div class="step-dot" :class="{ active: step === 2 }">2</div>
      </div>

      <div class="auth-subtitle">{{ currentStepDescription }}</div>
    </div>

    <!-- Шаг 1: Ввод email -->
    <q-slide-transition>
      <div v-if="step === 1" class="login-step">
        <q-form @submit="onEmailSubmit" class="login-form">
          <q-input
            v-model="email"
            label="Email *"
            type="text"
            outlined
            color="secondary"
            :error="!!fieldErrors.email"
            :error-message="fieldErrors.email"
            no-error-icon
            hide-bottom-space
            class="auth-input"
            @update:model-value="clearErrors"
          />

          <q-btn
            type="submit"
            color="secondary"
            size="lg"
            :loading="isLoading"
            :disable="isLoading"
            class="login-submit-button"
          >
            <template v-slot:default>
              Отправить код<br>подтверждения
            </template>
            <template v-slot:loading>
              <q-spinner-gears color="white" />
            </template>
          </q-btn>
        </q-form>
      </div>
    </q-slide-transition>

    <!-- Шаг 2: Ввод кода подтверждения -->
    <q-slide-transition>
      <div v-if="step === 2" class="login-step">
        <div class="text-center q-mb-md">
          <q-icon name="mark_email_read" size="48px" color="positive" class="q-mb-sm" />
          <p class="text-body1">
            Код подтверждения отправлен на<br>
            <strong>{{ email }}</strong>
          </p>
        </div>

        <q-form @submit="onCodeSubmit" class="login-code-form">
          <q-input
            v-model="confirmCode"
            label="Код подтверждения"
            outlined
            color="secondary"
            mask="######"
            hide-bottom-space
            input-class="text-center"
            class="auth-input"
            input-style="font-size: 1.5rem; letter-spacing: 0.5rem; text-align: center;"
          />

          <q-btn
            type="submit"
            color="secondary"
            size="lg"
            :loading="isLoading"
            :disable="!confirmCode || confirmCode.length !== 6 || isLoading"
            label="Войти"
            class="q-mt-md"
          >
            <template v-slot:loading>
              <q-spinner-gears color="white" />
            </template>
          </q-btn>

          <q-btn
            flat
            color="grey-7"
            size="lg"
            label="Отправить повторно"
            @click="resendCode"
            :disable="isLoading"
            class="q-mt-xs"
          />
        </q-form>
      </div>
    </q-slide-transition>

    <div class="text-center q-mt-sm">
      <p class="text-body2">
        Нет аккаунта?
        <router-link to="/auth/register" class="text-secondary text-decoration-none">
          Зарегистрироваться
        </router-link>
      </p>
    </div>

    <div class="q-mt-xs">
      <q-btn
        flat
        round
        icon="arrow_back"
        color="grey-7"
        no-caps
        @click="goToAuthSelect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../shared/composable'

const router = useRouter()
const { startLogin, finishLogin, isLoading } = useAuth()

const step = ref(1)
const email = ref('')
const confirmCode = ref('')

const fieldErrors = reactive({
  email: ''
})

function clearErrors() {
  fieldErrors.email = ''
}

function validateStep1(): boolean {
  fieldErrors.email = ''

  const val = email.value?.trim() ?? ''
  if (!val) {
    fieldErrors.email = 'Email обязателен'
    return false
  }
  if (!/.+@.+\..+/.test(val)) {
    fieldErrors.email = 'Некорректный формат email'
    return false
  }
  return true
}

const currentStepDescription = computed(() => {
  return step.value === 1
    ? 'Введите ваш email для входа в аккаунт'
    : 'Введите 6-значный код из письма'
})

const goToAuthSelect = () => {
  router.push('/auth').catch(() => {})
}

const onEmailSubmit = async () => {
  if (!validateStep1()) return
  try {
    await startLogin(email.value)
    step.value = 2
  } catch {
    // Ошибка уже обработана в useAuth
  }
}

const onCodeSubmit = async () => {
  try {
    await finishLogin(confirmCode.value)
    // Перенаправление произойдет автоматически в useAuth
  } catch {
    // Ошибка уже обработана в useAuth
    confirmCode.value = ''
  }
}


const resendCode = async () => {
  try {
    await startLogin(email.value)
  } catch {
    // Ошибка уже обработана в useAuth
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  width: 480px;
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-section {
  text-align: center;
}

.logo-image {
  height: 240px;
  object-fit: contain;
  border-radius: 16px;
  margin-bottom: -1rem;
}

.auth-title {
  margin: 0 0 0.5rem 0;
  font-weight: 300;
  font-size: 3.5rem;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1rem 0;
  gap: 0.5rem;
}

.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.7);
  transition: all 0.3s ease;

  .body--dark & {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.7);
  }

  &.active {
    background: var(--q-secondary);
    border-color: var(--q-secondary);
    color: white;
    box-shadow: 0 0 0 3px rgba(var(--q-secondary-rgb), 0.3);
  }
}

.step-line {
  width: 40px;
  height: 2px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1px;

  .body--dark & {
    background: rgba(255, 255, 255, 0.3);
  }
}

.auth-subtitle {
  color: #666;
  font-size: 0.9rem;
}

.login-step {
  margin-bottom: 1rem;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-code-form {
  display: flex;
  flex-direction: column;
  align-items: stretch;

  .q-btn[type="submit"] {
    width: 100%;
  }

  .q-btn:not([type="submit"]) {
    width: 100%;
  }
}

.auth-input {
  width: 100%;
}

.login-submit-button {
  width: 100%;
  text-transform: none;
  font-weight: 500;
  border-radius: 50px !important;
  line-height: 1.3;
}

.q-btn {
  text-transform: none;
  font-weight: 500;
  border-radius: 50px !important;
}

@media (max-width: 600px) {
  .login-container {
    padding: 1rem;
  }

  .logo-image {
    width: 90px;
    height: 90px;
  }

  .step-indicator {
    gap: 0.25rem;
  }

  .step-line {
    width: 30px;
  }
}
</style>
