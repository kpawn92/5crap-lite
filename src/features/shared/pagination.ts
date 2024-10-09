export const pagination = {
  calc: (total: number) => {
    const itemsPerPage = 15;
    const totalPages = Math.ceil(total / itemsPerPage);
    const pages: number[] = [];

    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

    return pages;
  },
};
