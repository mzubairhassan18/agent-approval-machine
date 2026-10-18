import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emailAdapter, scheduleAdapter } from "../src/adapters";
import type { ScheduleItem, SendItem } from "../src/machines";
import { ApprovalDialog } from "../src/ui/approval-dialog";
import { ApprovalTable } from "../src/ui/approval-table";

const emails: SendItem[] = [
  { id: "e1", to: "ali@acme.com", subject: "quick intro", body: "hi ali" },
  { id: "e2", to: "sam@acme.com", subject: "quick intro", body: "hi sam" },
];

describe("ApprovalDialog", () => {
  it("renders the adapter output and approves everything open", async () => {
    const onExecute = vi.fn(async (sent: SendItem[]) => ({ succeeded: sent, failed: [] }));

    render(<ApprovalDialog adapter={emailAdapter} items={emails} onExecute={onExecute} />);

    expect(screen.getByText("ali@acme.com")).toBeTruthy();
    expect(screen.getAllByLabelText("Subject")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /approve all/i }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    expect(onExecute.mock.calls[0][0]).toHaveLength(2);
  });

  it("sends the edited body through the adapter", async () => {
    const onExecute = vi.fn(async (sent: SendItem[]) => ({ succeeded: sent, failed: [] }));

    render(<ApprovalDialog adapter={emailAdapter} items={emails} onExecute={onExecute} />);

    const bodies = screen.getAllByLabelText("Body");
    fireEvent.change(bodies[0], { target: { value: "hi ali, edited by a human" } });

    // The dialog header also says "in edit", so scope the badge by its class-free text.
    expect(screen.getAllByText("edited")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /approve all/i }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    expect(onExecute.mock.calls[0][0][0]).toMatchObject({
      id: "e1",
      body: "hi ali, edited by a human",
    });
  });

  it("shows the partial failure, its reason, and retries it", async () => {
    const onExecute = vi
      .fn()
      .mockResolvedValueOnce({
        succeeded: [emails[0]],
        failed: [{ item: emails[1], error: "quota exceeded: 2/2 daily limit" }],
      })
      .mockResolvedValueOnce({ succeeded: [emails[1]], failed: [] });

    render(<ApprovalDialog adapter={emailAdapter} items={emails} onExecute={onExecute} />);

    fireEvent.click(screen.getByRole("button", { name: /approve all/i }));

    await waitFor(() =>
      expect(screen.getByText("quota exceeded: 2/2 daily limit")).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: /retry 1 failed/i }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(2));
    expect(onExecute.mock.calls[1][0]).toHaveLength(1);
  });

  it("blocks approve when the adapter's validate() says the item is not ready", async () => {
    const slots: ScheduleItem[] = [
      {
        id: "s1",
        title: "Book with Ali",
        proposedTimes: ["Tue 10:00", "Wed 14:00"],
        attendees: ["ali@acme.com"],
      },
    ];
    const onExecute = vi.fn(async (sent: ScheduleItem[]) => ({ succeeded: sent, failed: [] }));

    render(<ApprovalDialog adapter={scheduleAdapter} items={slots} onExecute={onExecute} />);

    fireEvent.click(screen.getByRole("button", { name: /approve all/i }));

    expect(await screen.findByText("Pick a time before approving")).toBeTruthy();
    expect(onExecute).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Wed 14:00/ }));
    fireEvent.click(screen.getByRole("button", { name: /approve all/i }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    expect(onExecute.mock.calls[0][0][0]).toMatchObject({ selectedTime: "Wed 14:00" });
  });
});

describe("ApprovalTable", () => {
  it("renders one row per item with a status column", () => {
    render(<ApprovalTable adapter={emailAdapter} items={emails} onExecute={vi.fn()} />);

    expect(screen.getByText("Approval queue")).toBeTruthy();

    // header row + one row per item ("needs approval" also labels a timeline step)
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("needs approval")).toBeTruthy();
    expect(within(rows[2]).getByText("needs approval")).toBeTruthy();

    expect(screen.getAllByRole("button", { name: /^approve$/i })).toHaveLength(2);
  });
});
