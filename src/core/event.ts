import { EventEmitter } from "events";
import { EventMap } from "./event.type";
import { processManager } from "./process.manager";

export class ExtendableEventManager extends EventEmitter {
  private static instance: ExtendableEventManager;

  private constructor() {
    super();
  }

  static getInstance(): ExtendableEventManager {
    if (!ExtendableEventManager.instance) {
      ExtendableEventManager.instance = new ExtendableEventManager();
    }
    return ExtendableEventManager.instance;
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => void
  ): this {
    return super.on(event, listener);
  }

  // Método para registrar nodos de escucha
  registerListeners(
    listeners: Record<keyof EventMap, (data: any) => void>
  ): void {
    for (const [event, listener] of Object.entries(listeners)) {
      this.on(event as keyof EventMap, listener);
    }
  }
}

const eventManager = ExtendableEventManager.getInstance();

// Registrar nodos personalizados
eventManager.registerListeners({
  "error-action": ({ error, process }) => {
    console.warn("[Process]:", process);
    console.error(error);
    // --> manejar el error
  },
  "worker-completed": ({ processName, workerId }) => {
    console.log(
      `[Listener] Worker ${workerId} completed for process ${processName}`
    );
  },
  "process-state-changed": ({ processName, newState }) => {
    console.log(
      `[Listener] Process ${processName} changed state to: ${newState}`
    );
    const processAll = processManager.getAllProcesses();
    console.log("Procceess all");
    console.table(processAll.map((p) => ({ name: p.name, state: p.state })));
    console.log("Workers");
    console.table(
      processAll
        .map((p) => p.workers.map((w) => ({ id: w.id, status: w.status })))
        .flat()
    );
  },
});

export default eventManager;
