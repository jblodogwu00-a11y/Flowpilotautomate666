export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'flowpilot2026';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(req) {
  const body = await req.json();
  console.log('Webhook received:', JSON.stringify(body, null, 2));

  // TODO: Save to database here

  return new Response('EVENT_RECEIVED', { status: 200 });
}
