import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: "new-pat-token" } });
    expect(setPatInput).toHaveBeenCalledWith("new-pat-token");

    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows error and triggers submit on Enter when not loading", () => {
    const onSubmit = vi.fn();

    render(
      <PatStep
        err="PAT invalide"
        patInput="abc"
        setPatInput={vi.fn()}
        loading={false}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("Erreur :")).toBeInTheDocument();
    expect(screen.getByText("PAT invalide")).toBeInTheDocument();

    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables submit button while loading and does not submit on Enter", () => {
    const onSubmit = vi.fn();

    render(
      <PatStep
        err=""
        patInput="abc"
        setPatInput={vi.fn()}
        loading
        onSubmit={onSubmit}
      />,
    );

    const button = screen.getByRole("button", { name: "Validation..." });
    expect(button).toBeDisabled();

    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("focuses PAT input when connection screen is displayed", async () => {
    render(
      <PatStep
        err=""
        patInput=""
        setPatInput={vi.fn()}
        loading={false}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('input[type="password"]'));
    });
  });
});
