import dynamic from 'next/dynamic'

const NetworkMapClient = dynamic(() => import('./network-map-client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-sm font-medium text-slate-500">Loading network map…</div>
    </div>
  ),
})

export default function NetworkMapPage() {
  return <NetworkMapClient />
}
