# Smart Sender — Webhooks

React 19, TypeScript (strict), Vite, Mantine, TanStack Query, React Router, react-hook-form + zod, MSW.

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 2 parallel 401s → 1 rotate → successful retries
```

Test login: `smart_sender@example.com` / `password123`

> Credentials are hardcoded in the mock to keep the task simple. In a real project, even test credentials should live in `.env` (e.g. `VITE_TEST_EMAIL`), not in the source code.

## Structure

```
src/api/client.ts      CSRF, 419 retry, shared rotate on 401
src/api/endpoints.ts   /v1/* calls
src/auth/AuthContext   current user, login / logout
src/pages/             login, list, edit
src/mocks/handlers.ts  MSW mock
```

## Decisions

- Session logic lives only in `client.ts`; the UI knows nothing about 401/419.
- Parallel 401s wait for one shared rotate, then retry once. Failed rotate or a second 401 → logout.
- `device_session_token` is kept in memory only; fingerprint is in localStorage.
- Page and search are stored in the URL. Search is debounced (300 ms).
- TanStack Query handles data and cache. The cache is cleared on logout.
- Edit form: zod validation on the client, server 422 errors shown next to fields, data loaded from `GET /v1/webhooks/{id}`.
