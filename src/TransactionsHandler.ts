import crypto from "crypto";
import { Signer } from "koilib";
import {
  OperationJson,
  TransactionJson,
  TransactionReceipt,
} from "koilib/lib/interface";
import { log } from "./utilsFogata";

export interface TransactionsHandlerResponse {
  transaction?: TransactionJson;
  receipt?: TransactionReceipt;
  errors?: string[];
}

export class TransactionsHandlerError extends Error {
  transaction?: TransactionJson;

  receipt?: TransactionReceipt;

  errors?: string[];

  constructor(r: TransactionsHandlerResponse) {
    super("transaction error");
    this.transaction = r.transaction;
    this.receipt = r.receipt;
    this.errors = r.errors;
  }
}

interface Rec {
  id: string;
  summary: string;
  operations: OperationJson[];
  availableRetries: number;
  transaction?: TransactionJson;
  receipt?: TransactionReceipt;
  sendTime?: number;
  pending: boolean;
  errors: string[];
  success: boolean;
}

export class TransactionsHandler {
  signer: Signer;
  records: Rec[];
  recordsProcessed: Rec[];
  txWaitingTime: number;
  periodTime: number;
  retries: number;

  constructor(
    signer: Signer,
    opts?: {
      txWaitingTime?: number;
      periodTime?: number;
      retries?: number;
    }
  ) {
    if (!signer.provider) {
      throw new Error("no provider defined in the signer");
    }
    this.signer = signer;
    this.records = [];
    this.recordsProcessed = [];
    this.txWaitingTime = 30000;
    this.retries = 3;
    this.periodTime = 10000;
    if (opts) {
      if (opts.txWaitingTime) this.txWaitingTime = opts.txWaitingTime;
      if (opts.periodTime) this.periodTime = opts.periodTime;
      if (opts.retries) this.retries = opts.retries;
    }
    setInterval(() => {
      this.processNext();
    }, this.periodTime);
  }

  push(
    contractName: string,
    summary: string,
    operations: OperationJson[],
    retries?: number
  ): Promise<TransactionsHandlerResponse> {
    const id = `${contractName}-${crypto.randomBytes(4).toString("hex")}`;
    const rec = {
      id,
      summary,
      operations,
      availableRetries: retries || this.retries,
      pending: true,
      success: false,
      errors: [],
    };
    this.records.push(rec);
    log(`start ${summary}`, rec);
    return new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        const i = this.recordsProcessed.findIndex((r) => r.id === id);
        if (i < 0) return;
        const [record] = this.recordsProcessed.splice(i, 1);
        const result = {
          transaction: record.transaction,
          receipt: record.receipt,
          errors: record.errors,
        };
        if (record.success) {
          log(`done - ${summary}`, record);
          resolve(result);
        } else {
          reject(new TransactionsHandlerError(result));
        }
        clearInterval(timer);
      }, 1000);
    });
  }

  async broadcastTransaction(
    record: Rec,
    isRetry = false
  ): Promise<{ record: Rec; message: string }> {
    try {
      if (record.availableRetries <= 0) {
        record.pending = false;
        return {
          record,
          message: "record with no more retries",
        };
      }
      let tx: TransactionJson;
      if (isRetry) {
        log("retry: processing operations", record);
        tx = record.transaction!;
      } else {
        log("processing new operations", record);
        const payeeAccount = new Signer({ privateKey: crypto.randomBytes(32) });
        const maxMana = await this.signer.provider!.getAccountRc(
          this.signer.address
        );
        const mana = (BigInt(maxMana) / BigInt(10)).toString();
        tx = await this.signer.prepareTransaction({
          header: {
            payee: payeeAccount.address,
            rc_limit: mana,
          },
          operations: record.operations,
        });
        await payeeAccount.signTransaction(tx);
        await this.signer.signTransaction(tx);
        log("transaction created", { id: record.id, transaction: tx });
      }
      const { transaction, receipt } = await this.signer.sendTransaction(tx);
      Object.assign(record, { transaction, receipt, sendTime: Date.now() });
      return { record, message: "transaction submitted" };
    } catch (error) {
      record.availableRetries -= 1;
      record.errors.push((error as Error).toString());
      record.pending = record.availableRetries > 0;
      return {
        record,
        message: `transaction error. available retries: ${record.availableRetries}`,
      };
    }
  }

  async searchTransactionId(
    record: Rec
  ): Promise<{ record: Rec; message: string }> {
    try {
      const { transactions: txs } =
        await this.signer.provider!.getTransactionsById([
          record.transaction!.id!,
        ]);
      if (!txs || !txs[0] || !txs[0].containing_blocks) {
        return { record, message: "" };
      }

      const { containing_blocks: blockIds } = txs[0];
      const blocks = await this.signer.provider!.getBlocksById(blockIds);
      const blockNumbers = blocks.block_items.map(
        (blockItem) => blockItem.block_height
      );
      Object.assign(record, {
        blockIds,
        blockNumbers,
        pending: false,
        success: true,
      });
      return { record, message: "transaction mined" };
    } catch (error) {
      Object.assign(record, { error: (error as Error).toString() });
      log("provider error", record);
      return { record, message: "" };
    }
  }

  async processRecord(record: Rec): Promise<{ record: Rec; message: string }> {
    // check if it is already broadcasted
    if (!record.transaction) {
      return this.broadcastTransaction(record);
    }

    // search transaction id
    const result = await this.searchTransactionId(record);
    if (!result.record.pending) return result;

    // not found. Check if it's time to retry
    if (Date.now() > record.sendTime! + this.txWaitingTime) {
      record.availableRetries -= 1;
      return this.broadcastTransaction(record, true);
    }

    // wait and check later
    return { record, message: "transaction not mined yet" };
  }

  async processNext(): Promise<void> {
    const rec = this.records.shift();
    if (!rec) return;
    const { record, message } = await this.processRecord(rec);
    log(message, record);
    if (record.pending) {
      // bring back to the queue again
      this.records.push(record);
    } else {
      this.recordsProcessed.push(record);
    }
  }
}
