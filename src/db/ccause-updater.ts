import { CauseCivil } from "./civil-cause.schema";

export const ccaseDocumentUpdater = async (rol: string, filename: string) => {
  await CauseCivil.findOneAndUpdate(
    { rol },
    {
      $pull: {
        "movementsHistory.$[].document": `${filename}.pdf`,
      },
    },
    { new: true }
  );
  console.log(CauseCivil.name, "Civil case updated", rol);
};
