import { getTracker, isValidEditPassword, mutateTracker } from '@/db/tracker-store';
import { isStructuralMutation, type TrackerMutation } from '@/lib/tracker';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  try {
    return Response.json(await getTracker(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error(error);
    return jsonError('The shared board is temporarily unavailable.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const mutation = await request.json() as TrackerMutation;
    if (!mutation || typeof mutation.kind !== 'string') return jsonError('Invalid update.', 400);

    if (isStructuralMutation(mutation)) {
      const password = request.headers.get('x-edit-password') || '';
      if (!(await isValidEditPassword(password))) return jsonError('Incorrect edit password.', 401);
    }

    return Response.json(await mutateTracker(mutation), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The board could not be updated.';
    const status = /no longer exists|cannot be empty|too long|Invalid/.test(message) ? 400 : 500;
    return jsonError(message, status);
  }
}
