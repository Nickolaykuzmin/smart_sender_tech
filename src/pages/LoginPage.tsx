import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Alert, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { ApiError } from '../api/client'
import type { FieldErrors } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Go back to the previous page after login.
  const from = (location.state as { from?: string } | null)?.from ?? '/webhooks'
  if (user) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setFormError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(err.payload)
      else setFormError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Paper component="form" onSubmit={handleSubmit} noValidate w={380} p="xl" radius="md" shadow="md" withBorder>
        <Stack>
          <div>
            <Title order={2}>Вхід</Title>
            <Text c="dimmed" size="sm">
              Smart Sender · вебхуки
            </Text>
          </div>
          <TextInput
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            error={errors.email?.join(' ')}
          />
          <PasswordInput
            label="Пароль"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            error={errors.password?.join(' ')}
          />
          {formError && <Alert color="red">{formError}</Alert>}
          <Button type="submit" loading={submitting} fullWidth>
            Увійти
          </Button>
        </Stack>
      </Paper>
    </Center>
  )
}
