import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Anchor,
  Avatar,
  Badge,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { getWebhooks } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { EditWebhookModal } from './EditWebhookModal'

const SEARCH_DEBOUNCE_MS = 300

export function WebhooksPage() {
  const { user, logout } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const search = params.get('search') ?? ''
  const [editingId, setEditingId] = useState<number | null>(null)
  // Search goes to URL after 300ms.
  const [searchInput, setSearchInput] = useState(search)

  // Sync input on back/forward.
  useEffect(() => setSearchInput(search), [search])

  useEffect(() => {
    if (searchInput === search) return
    const timer = setTimeout(() => updateParams({ search: searchInput, page: 1 }, true), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, search])

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['webhooks', page, search],
    queryFn: () => getWebhooks(page, search),
    placeholderData: keepPreviousData,
  })

  function updateParams(next: { page?: number; search?: string }, replace = false) {
    const p = new URLSearchParams()
    const s = next.search ?? search
    const pg = next.page ?? page
    if (s) p.set('search', s)
    if (pg > 1) p.set('page', String(pg))
    setParams(p, { replace })
  }

  function renderContent() {
    if (isPending) {
      return (
        <Center py="xl">
          <Loader />
        </Center>
      )
    }
    if (isError) {
      return (
        <Alert color="red" title="Не вдалося завантажити">
          <Group justify="space-between">
            <Text size="sm">{error.message}</Text>
            <Button size="xs" variant="light" color="red" onClick={() => refetch()}>
              Повторити
            </Button>
          </Group>
        </Alert>
      )
    }
    if (data.data.length === 0) {
      return (
        <Stack align="center" py="xl" gap="xs">
          <Text c="dimmed">Нічого не знайдено</Text>
          {page > 1 && (
            <Button variant="subtle" size="xs" onClick={() => updateParams({ page: 1 })}>
              На першу сторінку
            </Button>
          )}
        </Stack>
      )
    }

    return (
      <>
        <Table.ScrollContainer minWidth={600}>
          <Table highlightOnHover verticalSpacing="sm" style={{ opacity: isFetching ? 0.6 : 1 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Назва</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.data.map((w) => (
                <Table.Tr key={w.id}>
                  <Table.Td fw={500}>{w.name}</Table.Td>
                  <Table.Td>
                    <Anchor href={w.url} target="_blank" rel="noreferrer" size="sm">
                      {w.url}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={w.active ? 'teal' : 'gray'} variant="light">
                      {w.active ? 'Активний' : 'Вимкнений'}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button size="xs" variant="light" onClick={() => setEditingId(w.id)}>
                      Редагувати
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">
            Всього: {data.paging.results.total}
          </Text>
          <Pagination
            total={data.paging.pages.last}
            value={page}
            onChange={(p) => updateParams({ page: p })}
          />
        </Group>
      </>
    )
  }

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Вебхуки</Title>
        <Group gap="sm">
          <Avatar color="blue" radius="xl" size="sm">
            {user?.first_name[0]}
            {user?.last_name[0]}
          </Avatar>
          <Text size="sm">{user?.name}</Text>
          <Button variant="default" size="xs" onClick={logout}>
            Вийти
          </Button>
        </Group>
      </Group>

      <Paper withBorder radius="md" p="md" shadow="xs">
        <TextInput
          placeholder="Пошук за назвою"
          value={searchInput}
          mb="md"
          onChange={(e) => setSearchInput(e.currentTarget.value)}
        />
        {renderContent()}
      </Paper>

      {editingId !== null && <EditWebhookModal id={editingId} onClose={() => setEditingId(null)} />}
    </Container>
  )
}
