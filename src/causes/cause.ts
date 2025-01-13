import { evalStatus } from "../core/action-status";
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
    const steps: { fn: () => Promise<void>; name: string }[] = [
      { fn: () => this.civilDetailScrap.init(), name: "CivilDetailScrap.init" },
      {
        fn: () => this.civilDetailScrap.navigateToCivilCausesTab(),
        name: "CivilDetailScrap.navigateToCivilCausesTab",
      },
      {
        fn: () => this.civilDetailScrap.applyRolFilter(rol),
        name: "CivilDetailScrap.applyRolFilter",
      },
      {
        fn: () => this.civilDetailScrap.collectCauses(),
        name: "CivilDetailScrap.collectCauses",
      },
      {
        fn: () => this.civilDetailScrap.collectDetails(),
        name: "CivilDetailScrap.collectDetails",
      },
      {
        fn: () => this.civilDetailScrap.collectDocuments(),
        name: "CivilDetailScrap.collectDocuments",
      },
      {
        fn: () => this.civilDetailScrap.finish(),
        name: "CivilDetailScrap.finish",
      },
    ];

    for (const { fn, name } of steps) {
      await evalStatus(fn, name);
    }

    return this.civilDetailScrap.getCauseCivil();
  }

  public get hasReplaceCivilDetail(): boolean {
    return this.civilDetailScrap.hasUpdate;
  }

  public getCivilDetailReplacement() {
    return this.civilDetailScrap.getCauseCivil();
  }
}
