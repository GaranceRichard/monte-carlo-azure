import { fireEvent, render, screen } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: "Choisir cette équipe" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("option", { name: "Aucune equipe disponible" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choisir cette équipe" })).toBeDisabled();
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

    expect(screen.getByRole("button", { name: "Choisir cette équipe" })).toBeDisabled();
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
});
