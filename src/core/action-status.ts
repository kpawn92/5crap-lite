import { processService } from "./process.status";

export const evalStatus = async (
  fn: () => Promise<void>,
  name: string
): Promise<void> => {
  // Crear un proceso en estado "pending"
  const process = await processService.createProcess(name);

  try {
    await fn();
    // Actualizar el estado a "success"
    await processService.updateProcess(process._id, { state: "success" });
  } catch (error) {
    // Actualizar el estado a "failed" y registrar el error
    await processService.updateProcess(process._id, {
      state: "failed",
      error,
    });
    throw error;
  }
};
