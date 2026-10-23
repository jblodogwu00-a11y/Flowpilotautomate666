export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === 'flowpilot2026') {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}
export async function POST(req) {
  return new Response('OK', { status: 200 });
}
