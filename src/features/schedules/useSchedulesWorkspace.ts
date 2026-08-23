import { useState } from "react";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleInput,
} from "../../types/workflow";
import {
  createSchedule,
  deleteSchedule,
  disableSchedule,
  enableSchedule,
  listScheduleEvents,
  listSchedules,
  updateSchedule,
} from "../../lib/workflowApi";
import { commandMessage } from "../../lib/workflowUi";

type UseSchedulesWorkspaceOptions = {
  setAppError: (message: string) => void;
};

export function useSchedulesWorkspace({ setAppError }: UseSchedulesWorkspaceOptions) {
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<WorkflowScheduleEvent[]>([]);
  const [focusedScheduleId, setFocusedScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSchedules() {
    setLoading(true);
    try {
      const items = await listSchedules();
      setSchedules(items);
      // A quiet schedules load must not clear an app error raised by another
      // workspace sharing this global error channel.
      return items;
    } catch (error) {
      setAppError(commandMessage(error));
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function submitCreateSchedule(input: WorkflowScheduleInput) {
    await createSchedule(input);
    await loadSchedules();
  }

  async function submitUpdateSchedule(
    scheduleId: string,
    input: WorkflowScheduleInput,
  ) {
    await updateSchedule(scheduleId, input);
    await loadSchedules();
  }

  async function removeSchedule(scheduleId: string) {
    setAppError("");
    try {
      await deleteSchedule(scheduleId);
      await loadSchedules();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function toggleSchedule(scheduleId: string, enabled: boolean) {
    setAppError("");
    try {
      if (enabled) {
        await enableSchedule(scheduleId);
      } else {
        await disableSchedule(scheduleId);
      }
      await loadSchedules();
    } catch (error) {
      setAppError(commandMessage(error));
      throw error;
    }
  }

  async function loadScheduleHistory(scheduleId: string) {
    setAppError("");
    try {
      setScheduleEvents(await listScheduleEvents({ schedule_id: scheduleId }));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  return {
    schedules,
    scheduleEvents,
    focusedScheduleId,
    loading,
    setFocusedScheduleId,
    loadSchedules,
    submitCreateSchedule,
    submitUpdateSchedule,
    removeSchedule,
    toggleSchedule,
    loadScheduleHistory,
  };
}
