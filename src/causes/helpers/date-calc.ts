export const dateCalc = (dateString: string): Date => {
  const [day, month, year] = dateString.split("/").map((item) => Number(item));
  return new Date(year, month - 1, day);
};
