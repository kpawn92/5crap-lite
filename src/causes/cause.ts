import { CivilCauseScrap } from "./civil-cause.scrap";

export class Cause {
  constructor(private readonly civil: CivilCauseScrap) {}

  async getAllCivils() {
    await this.civil.init();
    await this.civil.navigateToCivilCausesTab();
    await this.civil.applyActiveFilter();
    await this.civil.collectCauses();
    await this.civil.collectDetails();
    await this.civil.collectDocuments();
    await this.civil.finish();

    return this.civil.getCauses();
  }
}
