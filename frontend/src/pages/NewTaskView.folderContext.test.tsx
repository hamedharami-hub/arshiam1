import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeSidebarCounts } from "@/hooks/useSidebarCounts";

const mocks = vi.hoisted(() => ({
  persistTask: vi.fn(async (_userId: string, _task: Record<string, unknown>) => "saved" as const),
  deleteTask: vi.fn(async () => true),
  enqueueOp: vi.fn(async () => true),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "owner-1" } }) }));
vi.mock("@/hooks/useBilingual", () => ({
  useBilingual: () => ({ isEn: true, T: (_fa: string, en: string) => en, dir: "ltr" }),
}));
vi.mock("@/hooks/useShareAccess", () => ({
  useShareAccess: () => ({ canEdit: true, canComment: true, isOwner: true }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "en" }, t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@/lib/firebaseStore", () => {
  const empty = { data: [] as unknown[], error: null, count: 0 };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "limit", "update", "delete", "upsert"]) {
    chain[method] = () => chain;
  }
  chain.insert = async () => ({ data: null, error: null });
  chain.single = async () => ({ data: null, error: null });
  chain.then = (resolve: (value: typeof empty) => unknown) => Promise.resolve(empty).then(resolve);
  chain.catch = (reject: (reason: unknown) => unknown) => Promise.resolve(empty).catch(reject);
  return { firebaseStore: { from: () => chain } };
});
vi.mock("@/lib/firestoreDataService", () => ({
  persistTask: mocks.persistTask,
  deleteTask: mocks.deleteTask,
  upsertTask: vi.fn(async () => true),
  subscribeFolders: () => () => {},
  subscribeTags: () => () => {},
}));
vi.mock("@/lib/offlineQueue", () => ({
  enqueueOp: mocks.enqueueOp,
  enqueueOps: vi.fn(async () => true),
  getPendingOps: vi.fn(async () => []),
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
}));
// The editor's heavy children are irrelevant here; the title field and the
// autosave path are the real subject.
vi.mock("@/components/TaskSubtasksInline", () => ({ TaskSubtasksInline: () => null }));
vi.mock("@/components/TaskDescriptionEditor", () => ({ TaskDescriptionEditor: () => null }));
vi.mock("@/components/TaskActionSheet", () => ({ default: () => null }));
vi.mock("@/components/PomodoroSheet", () => ({ default: () => null }));
vi.mock("@/components/TaskOutcomeSheet", () => ({ TaskOutcomeSheet: () => null }));
vi.mock("@/components/TaskAIPanel", () => ({ TaskAIPanel: () => null }));

import NewTaskView from "./NewTaskView";

function renderFloatingPlusRoute(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/app/new/task?${query}`]}>
      <Routes>
        <Route path="/app/new/task" element={<NewTaskView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("the floating + route keeps the page context on the created task", () => {
  beforeEach(() => {
    mocks.persistTask.mockClear();
    mocks.persistTask.mockResolvedValue("saved" as const);
    mocks.deleteTask.mockClear();
    localStorage.clear();
  });

  it("writes folder_id, the chosen day and the status when the first save happens", async () => {
    const query = "folder_id=folder-1&work_date=2026-06-10&status=todo";
    renderFloatingPlusRoute(query);

    const title = await screen.findByLabelText("Task title", {}, { timeout: 4000 });
    fireEvent.change(title, { target: { value: "Task from the floating plus" } });

    await waitFor(() => expect(mocks.persistTask).toHaveBeenCalled(), { timeout: 5000 });
    const [, payload] = mocks.persistTask.mock.calls[0];

    expect(payload).toMatchObject({
      title: "Task from the floating plus",
      user_id: "owner-1",
      folder_id: "folder-1",
      work_date: "2026-06-10",
      status: "todo",
      completed: false,
    });

    // The sidebar counter is derived from exactly these task fields; a task
    // without folder_id lands in the inbox and the folder stays at zero.
    expect(computeSidebarCounts([])["folder:folder-1"] || 0).toBe(0);
    expect(computeSidebarCounts([payload as never])["folder:folder-1"]).toBe(1);
  });

  it("keeps the autosaved task when the page closes, and only deletes a really empty one", async () => {
    const first = renderFloatingPlusRoute("folder_id=folder-1&work_date=2026-06-10&status=todo");
    const title = await screen.findByLabelText("Task title", {}, { timeout: 4000 });
    fireEvent.change(title, { target: { value: "Saved before leaving" } });
    await waitFor(() => expect(mocks.persistTask).toHaveBeenCalledTimes(1), { timeout: 5000 });

    first.unmount();

    // Leaving the page used to compare against the mount snapshot, whose title
    // is still empty, and deleted the task the user had just created.
    await waitFor(() => expect(mocks.deleteTask).not.toHaveBeenCalled());
  });

  it("still removes a task whose title was cleared after the first save", async () => {
    const view = renderFloatingPlusRoute("folder_id=folder-1&status=todo");
    const title = await screen.findByLabelText("Task title", {}, { timeout: 4000 });
    fireEvent.change(title, { target: { value: "Typed then cleared" } });
    await waitFor(() => expect(mocks.persistTask).toHaveBeenCalledTimes(1), { timeout: 5000 });

    fireEvent.change(title, { target: { value: "" } });
    await waitFor(() => expect(mocks.persistTask).toHaveBeenCalledTimes(2), { timeout: 5000 });

    view.unmount();

    await waitFor(() => expect(mocks.deleteTask).toHaveBeenCalledTimes(1));
  });
});
