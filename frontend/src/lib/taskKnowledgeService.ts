export type KnowledgeDocument = { id: string; title: string; folder_id?: string | null };

export type TaskKnowledgeLink = {
  id: string;
  task_id: string;
  document_id: string;
  user_id: string;
  note_or_context?: string | null;
};

export function getTaskKnowledgeCacheKey(userId: string, taskId?: string): string {
  return taskId ? `task_knowledge_${userId}_${taskId}` : `task_knowledge_links:${userId || "guest"}`;
}

export async function getTaskKnowledgeLinks(_taskId: string, _userId?: string): Promise<TaskKnowledgeLink[]> {
  return [];
}

export async function getTaskKnowledgeDocs(_taskId: string, _userId?: string): Promise<KnowledgeDocument[]> {
  return [];
}

export async function linkTaskKnowledge(_userId: string, _taskId: string, _docId: string, _noteOrContext?: string): Promise<boolean> {
  return false;
}

export async function linkTaskToDocument(_userId: string, _taskId: string, _docId: string, _note?: string): Promise<boolean> {
  return false;
}

export async function unlinkTaskKnowledge(_userId: string, _taskId: string, _docId: string): Promise<boolean> {
  return false;
}

export async function deleteAllTaskKnowledgeLinks(_taskIds: string[], _userId?: string): Promise<void> {}
