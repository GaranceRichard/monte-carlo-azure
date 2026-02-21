import { fireEvent, render, screen } from "@testing-library/react";
import ProjectStep from "./ProjectStep";

describe("ProjectStep", () => {
  it("renders projects and lets user choose one", () => {
    const setSelectedProject = vi.fn();
    const onContinue = vi.fn();

    render(
      <ProjectStep
        err=""
        selectedOrg="org-a"
        projects={[{ id: "p1", name: "Projet A" }, { id: "p2", name: "Projet B" }]}
        selectedProject="Projet A"
        setSelectedProject={setSelectedProject}
        loading={false}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText("Choix du projet")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Projet B" } });
    expect(setSelectedProject).toHaveBeenCalledWith("Projet B");

    fireEvent.click(screen.getByRole("button", { name: "Choisir ce Projet" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("shows fallback when no project and disables submit", () => {
    render(
      <ProjectStep
        err="Aucun projet"
        selectedOrg="org-a"
        projects={[]}
        selectedProject=""
        setSelectedProject={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Aucun projet")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Aucun projet accessible" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choisir ce Projet" })).toBeDisabled();
  });

  it("shows loading state on submit button", () => {
    render(
      <ProjectStep
        err=""
        selectedOrg="org-a"
        projects={[{ id: "p1", name: "Projet A" }]}
        selectedProject="Projet A"
        setSelectedProject={vi.fn()}
        loading
        onContinue={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Chargement..." });
    expect(button).toBeDisabled();
  });
});
