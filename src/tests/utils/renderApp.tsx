import { render } from "@testing-library/react";
import App from "../../App";

export function renderApp() {
  window.localStorage.setItem("auth_token", "mock-session-token");
  return render(<App />);
}
