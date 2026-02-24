import { fireEvent, render, screen } from "@testing-library/react";
import AppHeader from "./AppHeader";

describe("AppHeader", () => {
  it("toggles theme and shows back/disconnect actions", () => {
    const toggleTheme = vi.fn();
    const onBack = vi.fn();
    const onDisconnect = vi.fn();

    render(
      <AppHeader
        theme="dark"
        toggleTheme={toggleTheme}
        showDisconnect
        onDisconnect={onDisconnect}
        backLabel="Retour"
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByTitle("Passer en mode jour"));
    expect(toggleTheme).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("does not render right-side actions when hidden", () => {
    render(<AppHeader theme="light" toggleTheme={vi.fn()} onDisconnect={vi.fn()} />);

    expect(screen.getByTitle("Passer en mode nuit")).toBeInTheDocument();
    expect(screen.queryByText("Se déconnecter")).not.toBeInTheDocument();
  });
});
