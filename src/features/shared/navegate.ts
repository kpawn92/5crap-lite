import { Scrape } from "../../tools/scrape";

const navigate = async (scrape: Scrape, tab = "a#civilTab"): Promise<void> => {
  try {
    await scrape.clickElement('a[onclick="misCausas();"]', 3500);
    await scrape.clickElement(tab, 3500);
    await scrape.simuleBodyAction();
    console.log("Navigated to civil causes tab.");
  } catch (error) {
    console.error("Error navigating to civil causes tab:", error);
    throw error;
  }
};

export const navigateTab = {
  civil: (scrape: Scrape) => navigate(scrape),
};
