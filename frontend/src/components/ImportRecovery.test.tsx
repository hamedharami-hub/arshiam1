import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GoogleImportButtons, SaveToDriveButton } from "./GoogleImportButtons";
import { connectGoogle, getGoogleStatus, importDriveFiles, pickFromDrive } from "@/lib/googleLink";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "en" } }) }));
vi.mock("@/hooks/useBilingual", () => ({ useBilingual: () => ({ isEn: true, T: (_fa: string, en: string) => en }) }));
vi.mock("@/hooks/useDeviceFormFactor", () => ({ useDeviceFormFactor: () => ({ prefersDialog: true }) }));
vi.mock("@/lib/googleLink", () => ({ getGoogleStatus: vi.fn(), connectGoogle: vi.fn(), importDriveFiles: vi.fn(), pickFromDrive: vi.fn(), pickFromPhotos: vi.fn(), uploadAttachmentToDrive: vi.fn(), openExternal: vi.fn() }));
vi.mock("@/lib/deviceContacts", () => ({
  isDeviceContactImportSupported: () => true,
  checkDeviceContactPermission: () => Promise.resolve(true),
  requestDeviceContactPermission: vi.fn(),
  fetchDeviceContacts: () => Promise.resolve({ contacts: ["Alice", "Bob"].map(name => ({ id: name, display_name: name, phones: [], emails: [], addresses: [], websites: [{ url: "https://example.com" }] })) }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getGoogleStatus).mockResolvedValue({ configured: true, connected: true, picker_ready: true });
  vi.mocked(connectGoogle).mockResolvedValue(undefined);
});

describe("import recovery", () => {
  it("keeps Google status errors visible and retries instead of disappearing", async () => {
    vi.mocked(getGoogleStatus).mockRejectedValueOnce(new Error("Network unavailable"));
    render(<GoogleImportButtons taskId="task" onImported={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "From Drive" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses the existing OAuth linking flow for disconnected import and save controls", async () => {
    vi.mocked(getGoogleStatus).mockResolvedValue({ configured: true, connected: false, picker_ready: true });
    const view = render(<GoogleImportButtons taskId="task" onImported={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect Google" }));
    await waitFor(() => expect(connectGoogle).toHaveBeenCalledOnce());
    view.unmount();
    render(<SaveToDriveButton attachmentId="attachment" />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect Google" }));
    await waitFor(() => expect(connectGoogle).toHaveBeenCalledTimes(2));
  });

  it("reports partial Google imports and retries through a new explicit file selection", async () => {
    vi.mocked(pickFromDrive).mockResolvedValueOnce(["one", "two"]).mockResolvedValueOnce(["two"]);
    vi.mocked(importDriveFiles).mockResolvedValueOnce({ items: [{ id: "one" } as never], errors: [{ detail: "two failed" }] }).mockResolvedValueOnce({ items: [{ id: "two" } as never], errors: [] });
    const onImported = vi.fn();
    render(<GoogleImportButtons taskId="task" onImported={onImported} />);
    fireEvent.click(await screen.findByRole("button", { name: "From Drive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("1 files saved");
    fireEvent.click(screen.getByRole("button", { name: "Retry (choose files)" }));
    await waitFor(() => expect(importDriveFiles).toHaveBeenLastCalledWith("task", ["two"]));
    expect(onImported).toHaveBeenCalledTimes(2);
  });

});
