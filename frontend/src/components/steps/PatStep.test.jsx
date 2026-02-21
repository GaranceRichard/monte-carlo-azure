import { fireEvent, render, screen } from "@testing-library/react";
import PatStep from "./PatStep";

describe("PatStep", () => {
  it("renders the PAT form and calls onSubmit", () => {
    const onSubmit = vi.fn();
    const setPatInput = vi.fn();

    render(
      <PatStep
        err=""
        patInput=""
        setPatInput={setPatInput}
        loading={false}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("Connexion Azure DevOps")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Se connecter" });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
