import { Contract } from "koilib";
import { defineGetAllAccounts } from "./utilsFogata";

export class FogataContract extends Contract {
  paymentBeneficiaries: {
    next: number;
    processing: boolean;
  };

  reburn: {
    next: number;
    processing: boolean;
  };

  collect: {
    next: number;
    processing: boolean;
  };

  constructor(opts: ConstructorParameters<typeof Contract>[0]) {
    super(opts);
    this.functions.get_all_accounts = defineGetAllAccounts(this.functions);
    this.paymentBeneficiaries = { next: 0, processing: false };
    this.reburn = { next: 0, processing: false };
    this.collect = { next: 0, processing: false };
  }
}

export interface Chunk {
  time: number;
  msg: string;
  data: { [x: string]: unknown };
}
