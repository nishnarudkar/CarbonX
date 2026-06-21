import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { NumberField } from "./NumberField";

describe("NumberField", () => {
  it("has no accessibility violations (with and without a hint)", async () => {
    const { container } = render(
      <>
        <NumberField id="plain" label="Plain" max={10} value={0} onChange={() => {}} />
        <NumberField
          id="hinted"
          label="Hinted"
          max={10}
          hint="Some help text."
          value={0}
          onChange={() => {}}
        />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("emits numeric values through onChange", async () => {
    const onChange = vi.fn();
    render(<NumberField id="n" label="Amount" max={100} value={0} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Amount"), "7");
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it("associates the hint via aria-describedby only when present", () => {
    render(
      <>
        <NumberField id="a" label="With hint" max={10} hint="Hint." value={0} onChange={() => {}} />
        <NumberField id="b" label="No hint" max={10} value={0} onChange={() => {}} />
      </>,
    );
    expect(screen.getByLabelText("With hint")).toHaveAccessibleDescription("Hint.");
    expect(screen.getByLabelText("No hint")).not.toHaveAttribute("aria-describedby");
  });

  it("renders browser-level bounds and integer steps when requested", () => {
    render(
      <NumberField id="i" label="Count" min={1} max={50} step={1} value={1} onChange={() => {}} />,
    );
    const input = screen.getByLabelText("Count");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "50");
    expect(input).toHaveAttribute("step", "1");
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("defaults to 0 when input value is NaN", () => {
    const onChange = vi.fn();
    render(<NumberField id="n" label="Amount" max={100} value={0} onChange={onChange} />);
    const input = screen.getByLabelText("Amount");
    Object.defineProperty(input, "value", { value: "abc", writable: true, configurable: true });
    fireEvent.change(input);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
