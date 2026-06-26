import { Db } from 'mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';

/**
 * "New users only" miniapp quests: user must not have already joined any quest
 * for the same miniappUrl (other tasks or this one after submit).
 *
 * Uses `tasks.completedBy` (set on /api/tasks/complete) and taskCompletions
 * with status pending or success — not only admin-approved success.
 */
export async function userAlreadyDidQuestForSameMiniapp(
  db: Db,
  task: BountyTask,
  fid: number,
): Promise<boolean> {
  if (task.type !== 'miniapp' || task.miniappAudience !== 'new_users_only' || !task.miniappUrl) {
    return false;
  }

  const tasksCollection = db.collection<BountyTask>('tasks');
  const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

  const tasksWithSameUrl = await tasksCollection
    .find(
      { miniappUrl: task.miniappUrl, status: { $ne: 'pending_deposit' } },
      { projection: { _id: 1, completedBy: 1 } },
    )
    .toArray();

  const sameMiniappTaskIds = tasksWithSameUrl.map((t) => t._id.toString());
  const inCompletedByAny = tasksWithSameUrl.some(
    (t) => Array.isArray(t.completedBy) && t.completedBy.includes(fid),
  );
  if (inCompletedByAny) return true;
  if (sameMiniappTaskIds.length === 0) return false;

  const existing = await completionsCollection.findOne({
    userFid: fid,
    status: { $in: ['pending', 'success'] },
    taskId: { $in: sameMiniappTaskIds },
  });
  return !!existing;
}
