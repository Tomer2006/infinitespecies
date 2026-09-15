export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const backend = (process.env.TAXONOMY_API_URL || 'http://127.0.0.1:8787/api').replace(/\/$/, '')
  const query = new URL(request.url).search
  try {
    const upstream = await fetch(`${backend}/${path.map(encodeURIComponent).join('/')}${query}`, {
      cache: 'no-store', signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    })
    return new Response(upstream.body, { status: upstream.status, headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store',
    } })
  } catch {
    return Response.json({ error: 'Taxonomy service unavailable' }, { status: 503 })
  }
}
