import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PasswordInput } from "@/components/ui/password-input";

describe("PasswordInput", () => {
  it("is hidden by default and toggles visibility", () => {
    render(
      <>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" />
      </>,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hide);
    expect(input).toHaveAttribute("type", "password");
  });

  it("does not submit the surrounding form when toggled", () => {
    let submitted = false;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitted = true;
        }}
      >
        <PasswordInput aria-label="Password" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(submitted).toBe(false);
  });
});
