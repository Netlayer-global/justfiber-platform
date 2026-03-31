import { redirect } from 'next/navigation'

export default function UsagePackagesRedirectPage() {
  redirect('/plans?view=library')
}
