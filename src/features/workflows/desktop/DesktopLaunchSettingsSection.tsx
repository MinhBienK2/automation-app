import type { WorkflowSettingsDesktopLaunch } from "../../../types/workflow";
import { FormField } from "../../../components/ui/form-field";
import { Input } from "../../../components/ui/input";

type DesktopLaunchSettingsSectionProps = {
  value: WorkflowSettingsDesktopLaunch | null | undefined;
  onChange: (value: WorkflowSettingsDesktopLaunch) => void;
};

export function DesktopLaunchSettingsSection({
  value,
  onChange,
}: DesktopLaunchSettingsSectionProps) {
  const current = value || {
    app_executable_path: "",
    app_arguments: [],
    cua_driver_mode: "local",
  };

  const setField = <K extends keyof WorkflowSettingsDesktopLaunch>(
    key: K,
    val: WorkflowSettingsDesktopLaunch[K]
  ) => {
    onChange({
      ...current,
      [key]: val,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <FormField
        label="Application Executable Path"
        description="The absolute path to the desktop application executable on your system."
        htmlFor="desktop-executable-path"
      >
        <Input
          id="desktop-executable-path"
          value={current.app_executable_path || ""}
          onChange={(e) => setField("app_executable_path", e.currentTarget.value)}
          placeholder="/usr/bin/gnome-calculator or C:\Program Files\..."
          className="input-sm border-base-300 w-full"
        />
      </FormField>

      <FormField
        label="Command Line Arguments"
        description="Enter arguments to pass to the application (one argument per line)."
        htmlFor="desktop-arguments"
      >
        <textarea
          id="desktop-arguments"
          value={current.app_arguments?.join("\n") || ""}
          onChange={(e) =>
            setField(
              "app_arguments",
              e.currentTarget.value.split("\n").filter((line) => line.trim().length > 0)
            )
          }
          placeholder="--verbose&#10;--no-sandbox"
          rows={4}
          className="textarea textarea-bordered border-base-300 text-xs w-full p-2.5 font-mono leading-relaxed focus:outline-none focus:border-primary bg-base-100"
        />
      </FormField>

      <FormField
        label="CUA Driver Mode"
        description="Execution mode for Computer Use Agent driver."
        htmlFor="desktop-driver-mode"
      >
        <select
          id="desktop-driver-mode"
          value={current.cua_driver_mode || "local"}
          onChange={(e) => setField("cua_driver_mode", e.currentTarget.value as any)}
          className="select select-sm select-bordered border-base-300 w-full text-xs bg-base-100"
        >
          <option value="local">Local Daemon (cua-driver mcp)</option>
        </select>
      </FormField>
    </div>
  );
}
