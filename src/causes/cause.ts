import { CivilCauseRolCollectScrape } from "./civil-cause-rol.collect";
import { CivilCauseActiveScrape } from "./civil-cause.active";

export class Cause {
  constructor(
    private readonly civilScrap: CivilCauseActiveScrape,
    private readonly civilDetailScrap: CivilCauseRolCollectScrape
  ) {}

  async getCivilCauses() {
    await this.civilScrap.init();
    await this.civilScrap.navigateToCivilCausesTab();
    await this.civilScrap.applyActiveFilter();
    await this.civilScrap.collectCauses();
    await this.civilScrap.finish();
    return this.civilScrap.getCauses();
  }

  async getCivilCauseDetail(rol: string) {
    await this.civilDetailScrap.init();
    await this.civilDetailScrap.navigateToCivilCausesTab();
    await this.civilDetailScrap.applyRolFilter(rol);
    await this.civilDetailScrap.collectCauses();
    await this.civilDetailScrap.collectDetails();
    await this.civilDetailScrap.collectDocuments();
    await this.civilDetailScrap.finish();

    return this.civilDetailScrap.getCauses();
  }

  // async getAllCivils() {
  //   await this.civil.init();
  //   await this.civil.navigateToCivilCausesTab();
  //   await this.civil.applyActiveFilter();
  //   await this.civil.collectCauses();
  //   await this.civil.collectDetails();

  //   return this.civil.getCauses();
  // }
}
