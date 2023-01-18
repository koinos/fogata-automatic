import { Contract } from "koilib";
import { defineGetAllAccounts } from "./utilsFogata";

export class FogataContract extends Contract {
  nextReburn: number;

  constructor(opts: ConstructorParameters<typeof Contract>[0]) {
    super(opts);
    this.functions.get_all_accounts = defineGetAllAccounts(this.functions);
    this.nextReburn = 0;
  }
}
