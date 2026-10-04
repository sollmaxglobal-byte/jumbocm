import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/withdraw')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/withdraw"!</div>
}
