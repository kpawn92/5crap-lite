export type EventMap = {
  "worker-completed": { processName: string; workerId: string };
  "process-state-changed": { processName: string; newState: string };
};
