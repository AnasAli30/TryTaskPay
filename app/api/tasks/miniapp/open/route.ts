import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';

interface MiniappOpen {
  _id?: string;
  taskId: ObjectId;
  userFid: number;
  openedAt: Date;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { taskId?: string; userFid?: number };
    const { taskId, userFid } = body;

    if (!taskId || typeof userFid !== 'number') {
      return NextResponse.json({ error: 'Missing taskId or userFid' }, { status: 400 });
    }

    const db = await getDatabase();
    const opensCollection = db.collection<MiniappOpen>('taskMiniappOpens');

    await opensCollection.updateOne(
      { taskId: new ObjectId(taskId), userFid },
      { $set: { taskId: new ObjectId(taskId), userFid, openedAt: new Date() } },
      { upsert: true },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording miniapp open:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

