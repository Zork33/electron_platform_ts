import { describe, expect, test } from 'vitest'
import { ConfirmCodeSettingsService } from '../src/confirm-code-settings.js'

describe('confirm code settings', () => {
  test('exposes python-compatible cooldown and subjects', () => {
    const settings = new ConfirmCodeSettingsService({
      login: {
        sending_cooldown_seconds: 15,
        sending_subject: 'Login email subject',
      },
      registration: {
        sending_cooldown_seconds: 30,
        sending_subject: 'Registration email subject',
      },
    })

    expect(settings.getByReasonCode('LOGIN')).toMatchObject({
      reason_code: 'LOGIN',
      sending_cooldown_seconds: 15,
      sending_subject: 'Login email subject',
    })
    expect(settings.getByReasonCode('REGISTRATION')).toMatchObject({
      reason_code: 'REGISTRATION',
      sending_cooldown_seconds: 30,
      sending_subject: 'Registration email subject',
    })
  })
})
