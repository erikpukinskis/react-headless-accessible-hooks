import React from "react";
import { MyComponent } from "./";
import { describe, it } from "vitest";
import { render } from "@testing-library/react";

describe("MyComponent", () => {
  it("should render without errors", () => {
    render(<MyComponent />);
  });
});
