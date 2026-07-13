---
name: TanStack Query v5 queryKey required in Orval hooks
description: When passing options to Orval-generated hooks, TQ5 requires queryKey in the query object or typecheck fails.
---

When using Orval-generated query hooks with custom options (e.g. `refetchInterval`), you must include `queryKey` explicitly:

```ts
const { data } = useGetDmxState({
  query: { queryKey: getGetDmxStateQueryKey(), refetchInterval: 500 }
});
```

**Why:** TanStack Query v5 made `queryKey` required in `UseQueryOptions`. Passing `{ refetchInterval: N }` alone triggers `TS2741: Property 'queryKey' is missing`.

**How to apply:** Any time you add `refetchInterval` or other query options to an Orval-generated `useGet*` hook, always include the matching `getGet*QueryKey()` helper.
