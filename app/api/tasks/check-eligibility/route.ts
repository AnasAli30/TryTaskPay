import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask } from '@/lib/types';
import { checkEligibilityForTask } from '@/lib/taskEligibility';

/**
 * POST /api/tasks/check-eligibility
 * Body: { taskId: string, userFid: number }
 * Returns: { eligible: boolean, message?: string }
 * Same eligibility logic as verify route: uses task.minNeynarScore when set; no check when creator didn't set it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, userFid } = body as { taskId?: string; userFid?: number };
    if (!taskId || userFid == null) {
      return NextResponse.json({ error: 'Missing taskId or userFid' }, { status: 400 });
    }
    console.log('Checking eligibility for task:', taskId, 'and user:', userFid);

    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');
    const _id = new ObjectId(taskId);
    const task = await tasksCollection.findOne({ _id } as any);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    console.log('Task found:', task);

    const outcome = await checkEligibilityForTask(db, task, Number(userFid));
    return NextResponse.json(
      outcome.eligible ? { eligible: true } : { eligible: false, message: outcome.message },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error checking eligibility:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
