import { render, screen } from "@testing-library/react";
import OrgStep from "./OrgStep";
import ProjectStep from "./ProjectStep";
import TeamStep from "./TeamStep";

function expectNoMojibake(container) {
  expect(container.textContent).not.toMatch(/\\u00[0-9A-Fa-f]{2}/);
  expect(container.textContent).not.toMatch(/[Ãâ][^\s]*/);
}

describe("Onboarding mojibake guard", () => {
  it("renders onboarding labels without escaped unicode or mojibake", () => {
    const { container, rerender } = render(
      <OrgStep
        err=""
        userName="Garance Richard"
        orgs={[{ id: "1", name: "messqc" }]}
        orgHint={"PAT global détecté: sélectionnez une organisation accessible."}
        selectedOrg="messqc"
        setSelectedOrg={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Sélectionnez l'organisation Azure DevOps à utiliser.")).toBeInTheDocument();
    expect(
      screen.getByText("PAT global détecté: sélectionnez une organisation accessible."),
    ).toBeInTheDocument();
    expect(screen.getByText("Organisations accessibles")).toBeInTheDocument();
    expectNoMojibake(container);

    rerender(
      <ProjectStep
        err=""
        selectedOrg="messqc"
        projects={[{ id: "1", name: "Projet A" }]}
        selectedProject="Projet A"
        setSelectedProject={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Organisation sélectionnée:")).toBeInTheDocument();
    expect(screen.getByText("Projets accessibles")).toBeInTheDocument();
    expectNoMojibake(container);

    rerender(
      <TeamStep
        err=""
        selectedProject="Projet A"
        teams={[{ id: "1", name: "Équipe Alpha" }]}
        selectedTeam="Équipe Alpha"
        setSelectedTeam={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Choisir cette équipe" })).toBeInTheDocument();
    expectNoMojibake(container);
  });
});
