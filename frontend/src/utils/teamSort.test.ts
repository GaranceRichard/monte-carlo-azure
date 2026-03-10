import { describe, expect, it } from "vitest";
import { sortTeams } from "./teamSort";

describe("sortTeams", () => {
  it("sorts by normalized prefix before hyphen", () => {
    const teams = [
      { id: "3", name: "Zulu - Beta" },
      { id: "1", name: "Éclair - Alpha" },
      { id: "2", name: "alpha - Squad" },
    ];

    expect(sortTeams(teams).map((team) => team.name)).toEqual([
      "alpha - Squad",
      "Éclair - Alpha",
      "Zulu - Beta",
    ]);
  });

  it("uses full normalized name as secondary sort when prefixes match", () => {
    const teams = [
      { id: "2", name: "Alpha - Zeta" },
      { id: "1", name: "Alpha - Beta" },
      { id: "3", name: "Alpha - Éclair" },
    ];

    expect(sortTeams(teams).map((team) => team.name)).toEqual([
      "Alpha - Beta",
      "Alpha - Éclair",
      "Alpha - Zeta",
    ]);
  });

  it("handles empty and missing names safely", () => {
    const teams = [
      { id: "2", name: "Bravo" },
      { id: "1", name: "" },
      { id: "3" },
    ];

    expect(sortTeams(teams).map((team) => team.name ?? "")).toEqual(["", "", "Bravo"]);
  });
});
