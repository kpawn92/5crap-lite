export function parseStringToCode(value: string): string {
  const arrValue = value.split(" ");
  return arrValue.map((item) => item.toLowerCase()).join("_");
}
