import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { recommendationId, feedback } = await request.json();

  if (!recommendationId || !['good', 'bad'].includes(feedback)) {
    return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
  }

  // Verify ownership
  const { data: rec } = await supabase
    .from('recommendations')
    .select('id')
    .eq('id', recommendationId)
    .eq('user_id', user.id)
    .single();

  if (!rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('recommendations')
    .update({
      feedback,
      feedback_at: new Date().toISOString(),
    })
    .eq('id', recommendationId);

  if (error) {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
