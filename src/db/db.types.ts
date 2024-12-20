import { IssueOptions, ModeDocument } from "../causes/workers/worker.types";

export type UpdateRepository = (
  rol: string,
  filename: string,
  mode: ModeDocument,
  issue: IssueOptions
) => Promise<void>;
