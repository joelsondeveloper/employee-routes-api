import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import {GuestProvider, STORAGE_KEY, useGuest} from "./GuestContext";
import {api} from "../services/api";

const employee = {id: "demo-01", name: "Lucas", address: "Centro", phone: "(81) 99000-0001", latitude: -8.28, longitude: -35.03};

function Harness() {
  const {active, employees, enter, restore} = useGuest();
  return <div>
    <span>{active ? "active" : "inactive"}</span>
    <span>{employees.length}</span>
    <button onClick={() => void enter()}>enter</button>
    <button onClick={() => void restore()}>restore</button>
  </div>;
}

describe("GuestContext", () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("recovers safely from corrupted storage using the server dataset", async () => {
    localStorage.setItem(STORAGE_KEY, "{not-json");
    vi.spyOn(api, "listGuestEmployees").mockResolvedValue([employee]);
    const user = userEvent.setup();
    render(<GuestProvider><Harness /></GuestProvider>);
    await user.click(screen.getByRole("button", {name: "enter"}));
    await waitFor(() => expect(screen.getByText("active")).toBeInTheDocument());
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({version: 1, employees: [employee]});
  });

  it("restores the canonical dataset and persists it locally", async () => {
    vi.spyOn(api, "listGuestEmployees").mockResolvedValue([employee]);
    const user = userEvent.setup();
    render(<GuestProvider><Harness /></GuestProvider>);
    await user.click(screen.getByRole("button", {name: "enter"}));
    await user.click(screen.getByRole("button", {name: "restore"}));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({version: 1, employees: [employee]}));
  });
});

