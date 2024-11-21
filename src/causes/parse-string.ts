export const parseStringToCode = (value: string): string => {
  const chars = value
    .trim()
    .toLowerCase()
    .replaceAll("ñ", "n")
    .replaceAll("á", "a")
    .replaceAll("é", "e")
    .replaceAll("í", "i")
    .replaceAll("ó", "o")
    .replaceAll("ú", "u")
    .replaceAll("|", "_")
    .replaceAll("/", "_")
    .replaceAll('"', "_")
    .replaceAll("'", "_")
    .replaceAll("`", "_")
    .replaceAll(":", "_")
    .replaceAll("\\", "_")
    .split(" ");
  return chars.join("_");
};
