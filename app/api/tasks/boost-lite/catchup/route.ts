import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getBoostLiteAutoCatchupStats } from '@/lib/boostLiteAutoExecuteAll';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/boost-lite/catchup?taskId=...
 * Returns catch-up stats: slots left, eligible users left, incomplete exec rows.
 * Use to see how much auto-boost work remains; re-run deposit confirm or call autoExecuteBoostLiteForAll to catch up.
 */
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId')?.trim();
  if (!taskId || !ObjectId.isValid(taskId)) {
    return NextResponse.json({ error: 'taskId query param required' }, { status: 400 });
  }

  const stats = await getBoostLiteAutoCatchupStats(taskId);
  if (!stats) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (stats.taskType !== 'boost_lite') {
    return NextResponse.json(
      { error: 'Not a boost_lite task', taskType: stats.taskType },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ...stats,
    hint:
      'eligibleRemainingCount = opted-in users who can still be processed for this task. execIncompleteCount = rows still missing like or recast. Call auto-boost again (e.g. redeploy catch-up) if queue remains.',
  });
}
