import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';

interface MiniappAdd {
  _id?: string;
  taskId: ObjectId;
  userFid: number;
  addedAt: Date;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { taskId?: string; userFid?: number };
    const { taskId, userFid } = body;

    if (!taskId || typeof userFid !== 'number') {
      return NextResponse.json({ error: 'Missing taskId or userFid' }, { status: 400 });
    }

    const db = await getDatabase();
    const addsCollection = db.collection<MiniappAdd>('taskMiniappAdds');

    await addsCollection.updateOne(
      { taskId: new ObjectId(taskId), userFid },
      { $set: { taskId: new ObjectId(taskId), userFid, addedAt: new Date() } },
      { upsert: true },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording miniapp add:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
