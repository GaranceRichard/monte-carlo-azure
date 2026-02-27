import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TeamStep from "./TeamStep";

describe("TeamStep", () => {
  it("renders team list and allows selection", () => {
    const setSelectedTeam = vi.fn();
    const onContinue = vi.fn();

    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "t1", name: "Equipe Alpha" }, { id: "t2", name: "Equipe Beta" }]}
        selectedTeam="Equipe Alpha"
        setSelectedTeam={setSelectedTeam}
        loading={false}
        onContinue={onContinue}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Equipe Beta" } });
    expect(setSelectedTeam).toHaveBeenCalledWith("Equipe Beta");
    fireEvent.click(screen.getByRole("button", { name: /Choisir cette .quipe/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("opens portfolio mode from dedicated button", () => {
    const onPortfolio = vi.fn();
    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "t1", name: "Equipe Alpha" }]}
        selectedTeam="Equipe Alpha"
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
        onPortfolio={onPortfolio}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Portefeuille" }));
    expect(onPortfolio).toHaveBeenCalledTimes(1);
  });

  it("shows empty-state team option and disabled button", () => {
    render(
      <TeamStep
        err="Erreur team"
        selectedProject="Projet A"
        teams={[]}
        selectedTeam=""
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Erreur team")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Aucune .quipe disponible/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choisir cette .quipe/i })).toBeDisabled();
  });

  it("disables button while loading even with selected team", () => {
    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "t1", name: "Equipe Alpha" }]}
        selectedTeam="Equipe Alpha"
        setSelectedTeam={vi.fn()}
        loading
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Choisir cette .quipe/i })).toBeDisabled();
  });

  it("supports teams without id using name fallback", () => {
    const setSelectedTeam = vi.fn();

    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ name: "Equipe Sans Id" }]}
        selectedTeam="Equipe Sans Id"
        setSelectedTeam={setSelectedTeam}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Equipe Sans Id" } });
    expect(setSelectedTeam).toHaveBeenCalledWith("Equipe Sans Id");
    expect(screen.getByRole("option", { name: "Equipe Sans Id" })).toBeInTheDocument();
  });

  it("sorts teams by letters before hyphen", () => {
    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[
          { id: "t1", name: "Zulu-Team" },
          { id: "t2", name: "Alpha-Core" },
          { id: "t3", name: "Beta-Dev" },
        ]}
        selectedTeam="Alpha-Core"
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    const options = screen.getAllByRole("option").map((opt) => opt.textContent);
    expect(options).toEqual(["Alpha-Core", "Beta-Dev", "Zulu-Team"]);
  });

  it("submits on Enter with selected team", () => {
    const onContinue = vi.fn();

    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "t1", name: "Equipe Alpha" }]}
        selectedTeam="Equipe Alpha"
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={onContinue}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("focuses team list on mount", async () => {
    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "t1", name: "Equipe Alpha" }]}
        selectedTeam="Equipe Alpha"
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("combobox"));
    });
  });

  it("does not submit on Enter when loading or no team selected", () => {
    const onContinue = vi.fn();
    const { rerender } = render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "t1", name: "Equipe Alpha" }]}
        selectedTeam=""
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={onContinue}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onContinue).not.toHaveBeenCalled();

    rerender(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "t1", name: "Equipe Alpha" }]}
        selectedTeam="Equipe Alpha"
        setSelectedTeam={vi.fn()}
        loading
        onContinue={onContinue}
      />,
    );
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("applies secondary sort when team prefixes are identical", () => {
    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[
          { id: "t1", name: "Alpha-Zeta" },
          { id: "t2", name: "Alpha-Beta" },
        ]}
        selectedTeam="Alpha-Zeta"
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    const options = screen.getAllByRole("option").map((opt) => opt.textContent);
    expect(options).toEqual(["Alpha-Beta", "Alpha-Zeta"]);
  });

  it("handles teams without name using safe fallbacks", () => {
    render(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[
          { id: "t1", name: "" },
          { id: "t2" },
        ]}
        selectedTeam=""
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveValue("");
    expect(options[1]).toHaveValue("");
  });
});
