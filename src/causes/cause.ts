import { CivilCauseRolCollectScrape } from "./civil-cause-rol.collect";
import { CivilCauseActiveScrape } from "./civil-cause.active";

export class Cause {
  constructor(
    private readonly civilActiveScrap: CivilCauseActiveScrape,
    private readonly civilDetailScrap: CivilCauseRolCollectScrape
  ) {}

  async getCivilCauses() {
    await this.civilActiveScrap.init();
    await this.civilActiveScrap.navigateToCivilCausesTab();
    await this.civilActiveScrap.applyActiveFilter();
    await this.civilActiveScrap.collectCauses();
    await this.civilActiveScrap.finish();
    return this.civilActiveScrap.getCauses();
  }

  async getCivilCauseDetail(rol: string) {
    await this.civilDetailScrap.init();
    await this.civilDetailScrap.navigateToCivilCausesTab();
    await this.civilDetailScrap.applyRolFilter(rol);
    await this.civilDetailScrap.collectCauses();
    await this.civilDetailScrap.collectDetails();
    await this.civilDetailScrap.collectDocuments();
    await this.civilDetailScrap.finish();

    return this.civilDetailScrap.getCauseCivil();
  }

  public get hasReplaceCivilDetail(): boolean {
    return this.civilDetailScrap.hasUpdate;
  }

  public getCivilDetailReplacement() {
    return this.civilDetailScrap.getCauseCivil();
  }
}
