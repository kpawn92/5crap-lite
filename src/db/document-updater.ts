import { CauseCivil, CauseCivilUpdater } from "./civil-cause.schema";
import { UpdateRepository } from "./db.types";

export const updateRepository: UpdateRepository = async (
  rol,
  filename,
  mode,
  issue
) => {
  try {
    // Encuentra el documento que corresponde al `rol`
    const causeCivilDocument = await (issue === "daily"
      ? CauseCivilUpdater
      : CauseCivil
    ).findOne({ rol });

    if (!causeCivilDocument) {
      throw new Error(`CauseCivilDocument with rol ${rol} not found`);
    }

    // Recorre los movimientos para eliminar el archivo específico según `issue`
    causeCivilDocument.movementsHistory.forEach((movement) => {
      movement.document.forEach((doc) => {
        if (mode === "doc") {
          // Elimina el documento si el archivo coincide con `filename`
          movement.document = movement.document.filter(
            (document) => document.file !== filename
          );
        } else if (mode === "annex") {
          // Elimina el anexo si el archivo coincide con `filename`
          doc.annexs = doc.annexs.filter((annex) => annex.file !== filename);
        }
      });
    });

    // Guarda el documento actualizado en la base de datos
    await causeCivilDocument.save();

    console.log(`Files updated successfully for rol ${rol} and issue ${issue}`);
  } catch (error) {
    console.error("Error updating files:", error);
    throw error;
  }
};
