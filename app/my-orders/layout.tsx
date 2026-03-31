// Force dynamic rendering for my-orders pages
// This prevents prerendering issues on Cloudflare Workers
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function MyOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
