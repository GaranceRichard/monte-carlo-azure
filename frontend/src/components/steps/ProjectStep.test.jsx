import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("submits on Enter when a project is selected", () => {
    const onContinue = vi.fn();

    render(
      <ProjectStep
        err=""
        selectedOrg="org-a"
        projects={[{ id: "p1", name: "Projet A" }]}
        selectedProject="Projet A"
        setSelectedProject={vi.fn()}
        loading={false}
        onContinue={onContinue}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Enter when loading or when no project is selected", () => {
    const onContinue = vi.fn();
    const { rerender } = render(
      <ProjectStep
        err=""
        selectedOrg="org-a"
        projects={[{ id: "p1", name: "Projet A" }]}
        selectedProject=""
        setSelectedProject={vi.fn()}
        loading={false}
        onContinue={onContinue}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onContinue).not.toHaveBeenCalled();

    rerender(
      <ProjectStep
        err=""
        selectedOrg="org-a"
        projects={[{ id: "p1", name: "Projet A" }]}
        selectedProject="Projet A"
        setSelectedProject={vi.fn()}
        loading
        onContinue={onContinue}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("renders fallback option values when project names are missing", () => {
    render(
      <ProjectStep
        err=""
        selectedOrg="org-a"
        projects={[{ id: "p1", name: "" }, { id: "", name: "Projet B" }]}
        selectedProject=""
        setSelectedProject={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveValue("");
    expect(options[1]).toHaveValue("Projet B");
  });

  it("focuses projects select on mount", async () => {
    render(
      <ProjectStep
        err=""
        selectedOrg="org-a"
        projects={[{ id: "p1", name: "Projet A" }]}
        selectedProject="Projet A"
        setSelectedProject={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("combobox"));
    });
  });
});
