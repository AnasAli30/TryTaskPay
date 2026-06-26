import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/record-open
 * Records when a user opened a custom on-chain quest (starts the verify window).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : '';
    if (!taskId || !ObjectId.isValid(taskId)) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }

    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');
    const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) } as any);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.type !== 'custom_onchain') {
      return NextResponse.json({ error: 'Not a custom on-chain task' }, { status: 400 });
    }
    if (task.status !== 'active') {
      return NextResponse.json({ error: `Task is not active (current: ${task.status})` }, { status: 400 });
    }

    const userWallet = session.walletAddress.toLowerCase();
    const openedAt = new Date();
    const collection = db.collection<{ taskId: ObjectId; userWallet: string; openedAt: Date }>(
      'customTaskOpens',
    );

    await collection.updateOne(
      { taskId: new ObjectId(taskId), userWallet },
      { $set: { taskId: new ObjectId(taskId), userWallet, openedAt } },
      { upsert: true },
    );

    return NextResponse.json({ success: true, openedAt: openedAt.toISOString() });
  } catch (error) {
    console.error('[custom-actions/record-open]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
