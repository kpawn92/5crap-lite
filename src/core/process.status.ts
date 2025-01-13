import {
  ProcessStatusDocument,
  ProcessStatusModel,
} from "../db/process-status.model";

export class ProcessService {
  async createProcess(name: string): Promise<ProcessStatusDocument> {
    return await ProcessStatusModel.create({ name, state: "pending" });
  }

  async updateProcess(
    processId: string,
    updateData: Partial<ProcessStatusDocument>
  ): Promise<ProcessStatusDocument | null> {
    return await ProcessStatusModel.findByIdAndUpdate(processId, updateData, {
      new: true,
    });
  }
}

export const processService = new ProcessService();
