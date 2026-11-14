import { businessDate } from "./business-date";

const MAX_REASONABLE_PRE_CREATION_GAP_MS = 365 * 24 * 60 * 60 * 1000;

export function sharedTaskDueDate(dueAt: string | null | undefined, createdAt: string | null | undefined) {
  if (!dueAt) return { dueDate: "", storedDueDate: "", warning: "" };

  const dueInstant = new Date(dueAt);
  if (!Number.isFinite(dueInstant.getTime())) {
    return { dueDate: "", storedDueDate: dueAt, warning: "The stored due date is invalid and needs review." };
  }

  const storedDueDate = businessDate(dueInstant);
  const creationInstant = createdAt ? new Date(createdAt) : null;
  const predatesCreationByOverAYear = Boolean(
    creationInstant && Number.isFinite(creationInstant.getTime()) &&
      dueInstant.getTime() < creationInstant.getTime() - MAX_REASONABLE_PRE_CREATION_GAP_MS,
  );

  if (predatesCreationByOverAYear) {
    return {
      dueDate: "",
      storedDueDate,
      warning: `Stored due date ${storedDueDate} is over a year before this task was created; review the date.`,
    };
  }

  return { dueDate: storedDueDate, storedDueDate, warning: "" };
}
