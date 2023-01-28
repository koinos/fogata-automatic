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

  name: string;

  constructor(opts: ConstructorParameters<typeof Contract>[0], name: string) {
    super(opts);
    this.functions.get_all_accounts = defineGetAllAccounts(this.functions);
    this.paymentBeneficiaries = { next: 0, processing: false };
    this.reburn = { next: 0, processing: false };
    this.collect = { next: 0, processing: false };
    this.name = name;
  }
}

export interface Chunk {
  time: number;
  id?: string;
  msg: string;
  data: { [x: string]: unknown };
}
