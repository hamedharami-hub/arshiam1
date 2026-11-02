export type KnowledgeDocument = { id: string; title: string; folder_id?: string | null };

export function getTaskKnowledgeCacheKey(userId?: string | null): string {
  return `task_knowledge_links:${userId || "guest"}`;
}

export async function getTaskKnowledgeLinks(_taskId: string, _userId?: string): Promise<Array<{ id: string; task_id: string; document_id: string; user_id: string }>> {
  return [];
}

export async function getTaskKnowledgeDocs(_taskId: string, _userId?: string): Promise<KnowledgeDocument[]> {
  return [];
}

export async function linkTaskKnowledge(_userId: string, _taskId: string, _docId: string): Promise<boolean> {
  return false;
}

export async function linkTaskToDocument(_userId: string, _taskId: string, _docId: string, _note?: string): Promise<boolean> {
  return false;
}

export async function unlinkTaskKnowledge(_userId: string, _taskId: string, _docId: string): Promise<boolean> {
  return false;
}

export async function deleteAllTaskKnowledgeLinks(_taskIds: string[], _userId?: string): Promise<void> {}
