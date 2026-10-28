import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Center, Group, Loader, Modal, Stack, TextInput } from '@mantine/core'
import { ApiError } from '../api/client'
import { getWebhook, updateWebhook } from '../api/endpoints'
import type { Webhook } from '../api/types'

const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const schema = z.object({
  name: z.string().trim().min(1, 'Вкажіть назву'),
  url: z.string().trim().refine(isHttpUrl, 'Вкажіть коректну HTTP/HTTPS-адресу'),
})
type FormValues = z.infer<typeof schema>

export function EditWebhookModal({ id, onClose }: { id: number; onClose: () => void }) {
  // Load fresh data, the table row may be stale.
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['webhook', id],
    queryFn: () => getWebhook(id),
    gcTime: 0,
  })

  return (
    <Modal opened onClose={onClose} title="Редагування вебхука" centered>
      {isPending ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : error ? (
        <Alert color="red" title="Не вдалося завантажити">
          <Group justify="space-between">
            {error.message}
            <Button size="xs" variant="light" color="red" onClick={() => refetch()}>
              Повторити
            </Button>
          </Group>
        </Alert>
      ) : (
        <EditForm webhook={data} onClose={onClose} />
      )}
    </Modal>
  )
}

function EditForm({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: webhook.name, url: webhook.url },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateWebhook(webhook.id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      onClose()
    },
    onError: (err) => {
      if (!(err instanceof ApiError) || err.status !== 422) return
      // Show server errors next to fields.
      for (const [field, messages] of Object.entries(err.payload)) {
        if (field === 'name' || field === 'url') setError(field, { message: messages.join(' ') })
      }
    },
  })

  const err = mutation.error
  const isValidation = err instanceof ApiError && err.status === 422

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Stack>
        <TextInput label="Назва" {...register('name')} error={errors.name?.message} data-autofocus />
        <TextInput label="URL" {...register('url')} error={errors.url?.message} />
        {err && !isValidation && <Alert color="red">{err.message}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Зберегти
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
