import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Select } from "./select";

describe("Select component", () => {
  test("correctly parses complex children without joining them with commas", () => {
    render(
      <Select value="val1" onChange={() => {}}>
        <option value="val1">
          index_group_follow_in_fb {"("}Profile Env{")"}
        </option>
        <option value="val2">
          Second Option
        </option>
      </Select>
    );

    const option1 = screen.getByRole("option", { name: "index_group_follow_in_fb (Profile Env)" });
    expect(option1).toBeInTheDocument();
    expect(option1).toHaveTextContent("index_group_follow_in_fb (Profile Env)");
    expect(option1).not.toHaveTextContent("index_group_follow_in_fb, (,Profile Env,)");
  });
});
