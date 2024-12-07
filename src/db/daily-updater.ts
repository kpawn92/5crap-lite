import { CauseCivilUpdater } from "./civil-cause.schema";

export const dailyDocumentUpdater = async (rol: string, filename: string) => {
  await CauseCivilUpdater.findOneAndUpdate(
    { rol },
    {
      $pull: {
        // Usamos $pull para eliminar un valor específico del array
        "movementsHistory.$[].document": `${filename}.pdf`,
      },
    },
    { new: true }
  );
  console.log("Civil case updated", rol);
};
