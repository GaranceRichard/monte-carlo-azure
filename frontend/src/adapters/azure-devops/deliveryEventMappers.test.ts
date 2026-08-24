import { describe, expect, it } from "vitest";
import {
  azureRevisionDtosToDeliveryEvents,
  azureWorkItemDtoToDeliveryEvent,
} from "./deliveryEventMappers";

describe("Azure DevOps delivery event mappers", () => {
  it("maps a closed work item DTO to the normalized delivered fact", () => {
    expect(azureWorkItemDtoToDeliveryEvent({
      id: 42,
      fields: {
        "Microsoft.VSTS.Common.ClosedDate": "2026-01-12T10:30:00+02:00",
        "System.Title": "technical detail",
      },
    })).toEqual({
      itemId: "42",
      kind: "item_delivered",
      occurredAt: "2026-01-12T08:30:00.000Z",
    });
  });

  it("uses the resolved date when no closed date is present", () => {
    expect(azureWorkItemDtoToDeliveryEvent({
      id: 7,
      fields: {
        "Microsoft.VSTS.Common.ResolvedDate": "2026-01-13T09:00:00Z",
      },
    })).toMatchObject({
      itemId: "7",
      kind: "item_delivered",
      occurredAt: "2026-01-13T09:00:00.000Z",
    });
  });

  it.each([
    null,
    {},
    { id: 0, fields: { "Microsoft.VSTS.Common.ClosedDate": "2026-01-12T09:00:00Z" } },
    { id: 42, fields: { "Microsoft.VSTS.Common.ClosedDate": "invalid" } },
  ])("rejects an incomplete work item DTO without leaking it", (dto) => {
    expect(azureWorkItemDtoToDeliveryEvent(dto)).toBeNull();
  });

  it("maps state revisions to one started and one completed business fact", () => {
    expect(azureRevisionDtosToDeliveryEvents(42, [
      { fields: { "System.ChangedDate": "2026-01-15T09:00:00Z", "System.State": " Done " } },
      { fields: { "System.ChangedDate": "2026-01-06T09:00:00Z", "System.State": "New" } },
      { fields: { "System.ChangedDate": "2026-01-08T09:00:00Z", "System.State": "Active" } },
      { fields: { "System.ChangedDate": "2026-01-18T09:00:00Z", "System.State": "Done" } },
    ], ["done"])).toEqual([
      { itemId: "42", kind: "work_started", occurredAt: "2026-01-08T09:00:00.000Z" },
      { itemId: "42", kind: "work_completed", occurredAt: "2026-01-15T09:00:00.000Z" },
    ]);
  });

  it("orders revisions by their normalized absolute instant", () => {
    expect(azureRevisionDtosToDeliveryEvents(42, [
      { fields: { "System.ChangedDate": "2026-01-08T10:00:00+02:00", "System.State": "New" } },
      { fields: { "System.ChangedDate": "2026-01-08T09:00:00Z", "System.State": "Active" } },
      { fields: { "System.ChangedDate": "2026-01-09T09:00:00Z", "System.State": "Done" } },
    ], ["Done"])).toEqual([
      { itemId: "42", kind: "work_started", occurredAt: "2026-01-08T09:00:00.000Z" },
      { itemId: "42", kind: "work_completed", occurredAt: "2026-01-09T09:00:00.000Z" },
    ]);
  });

  it("keeps only the start fact when no done state is selected", () => {
    expect(azureRevisionDtosToDeliveryEvents(42, [
      { fields: { "System.ChangedDate": "2026-01-06T09:00:00Z", "System.State": "New" } },
      { fields: { "System.ChangedDate": "2026-01-08T09:00:00Z", "System.State": "Active" } },
    ], [])).toEqual([
      { itemId: "42", kind: "work_started", occurredAt: "2026-01-08T09:00:00.000Z" },
    ]);
  });

  it.each([
    [undefined, []],
    [42, null],
    [-1, []],
  ])("rejects invalid revision boundaries", (itemId, revisions) => {
    expect(azureRevisionDtosToDeliveryEvents(itemId, revisions, ["Done"])).toEqual([]);
  });
});
