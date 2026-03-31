import { redirect } from 'next/navigation'

export default async function AllUsersRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ group?: string }>
}) {
  const params = (await searchParams) || {}
  const query = new URLSearchParams({ view: 'users' })
  if (params.group) query.set('group', params.group)
  redirect(`/user-management?${query.toString()}`)
}
