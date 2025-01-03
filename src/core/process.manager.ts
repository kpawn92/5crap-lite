interface Worker {
  id: string;
  status: "pending" | "in_progress" | "success" | "failed";
}

// Interface para Process
interface Process {
  name: string;
  state: "pending" | "in_progress" | "success";
  workers: Worker[];
}

class ProcessManager {
  private static instance: ProcessManager;
  private processes: Map<string, Process> = new Map();

  private constructor() {}

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  // Crear o actualizar un proceso
  createProcess(name: string): Process {
    let process = this.processes.get(name);

    if (process) {
      // Si el proceso ya existe, actualiza el estado
      process.state = "pending";
    } else {
      // Si no existe, crea un nuevo proceso
      process = {
        name,
        state: "pending",
        workers: [],
      } as Process;
      this.processes.set(name, process);
    }

    return process;
  }

  // Agregar un worker al proceso
  addWorker(processName: string, workerId: string): Worker | null {
    const process = this.processes.get(processName);
    if (!process) return null;

    const existingWorker = process.workers.find((w) => w.id === workerId);
    if (existingWorker) return existingWorker; // Evita duplicar el worker

    const worker: Worker = {
      id: workerId,
      status: "pending",
    } as Worker;

    process.workers.push(worker);
    return worker;
  }

  // Actualizar el estado de un worker
  updateWorkerStatus(
    processName: string,
    workerId: string,
    status: Worker["status"]
  ): void {
    const process = this.processes.get(processName);
    if (!process) return;

    const worker = process.workers.find((w) => w.id === workerId);
    if (worker) {
      worker.status = status;
    }
  }

  // Actualizar el estado de un proceso
  updateProcessState(processName: string, state: Process["state"]): void {
    const process = this.processes.get(processName);
    if (!process) return;

    process.state = state;
  }

  // Obtener un proceso por nombre
  getProcess(processName: string): Process | undefined {
    return this.processes.get(processName);
  }

  // Obtener todos los procesos
  getAllProcesses(): Process[] {
    return Array.from(this.processes.values());
  }
}

export const processManager = ProcessManager.getInstance();
