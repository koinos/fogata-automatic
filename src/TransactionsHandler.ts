import crypto from "crypto";
import { Signer } from "koilib";
import { OperationJson, TransactionJson } from "koilib/lib/interface";

interface Rec {
  id: string;
  summary: string;
  operations: OperationJson[];
  availableRetries: number;
  transaction?: TransactionJson;
  sendTime?: number;
  [others: string]: unknown;
}

function log(msg: string, data: unknown): void {
  const time = Date.now();
  console.log(JSON.stringify({ time, msg, data }));
}

export class TransactionsHandler {
  signer: Signer;
  records: Rec[];
  txWaitingTime: number;
  retries: number;

  constructor(
    signer: Signer,
    opts?: {
      txWaitingTime?: number;
      retries: number;
    }
  ) {
    if (!signer.provider) {
      throw new Error("no provider defined in the signer");
    }
    this.signer = signer;
    this.records = [];
    this.txWaitingTime = 30000;
    this.retries = 3;
    if (opts) {
      if (opts.txWaitingTime) this.txWaitingTime = opts.txWaitingTime;
      if (opts.retries) this.retries = opts.retries;
    }
  }

  push(summary: string, operations: OperationJson[], retries?: number): void {
    const id = crypto.randomBytes(4).toString("hex");
    this.records.push({
      id,
      summary,
      operations,
      availableRetries: retries || this.retries,
    });
  }

  async broadcastTransaction(
    record: Rec,
    isRetry = false
  ): Promise<{ record: Rec; pending: boolean; message: string }> {
    try {
      if (record.availableRetries <= 0) {
        return {
          record,
          pending: false,
          message: "record with no more retries",
        };
      }
      const msg = isRetry
        ? "retry: processing operations"
        : "processing new operations";
      log(msg, record);
      const tx = await this.signer.prepareTransaction({
        operations: record.operations,
      });
      log("transaction created", tx);
      const { transaction, receipt } = await this.signer.sendTransaction(tx);
      Object.assign(record, { transaction, receipt, sendTime: Date.now() });
      return { record, pending: true, message: "transaction submitted" };
    } catch (error) {
      const availableRetries = record.availableRetries - 1;
      Object.assign(record, {
        error: (error as Error).toString(),
        availableRetries,
      });
      const pending = availableRetries > 0;
      return {
        record,
        pending,
        message: `transaction error. available retries: ${availableRetries}`,
      };
    }
  }

  async searchTransactionId(
    record: Rec
  ): Promise<{ record: Rec; pending: boolean; message: string }> {
    try {
      const { transactions: txs } =
        await this.signer.provider!.getTransactionsById([
          record.transaction!.id!,
        ]);
      if (!txs || !txs[0] || txs[0].containing_blocks)
        return { record, pending: true, message: "" };

      const { containing_blocks: blockIds } = txs[0];
      const blocks = await this.signer.provider!.getBlocksById(blockIds);
      const blockNumbers = blocks.block_items.map(
        (blockItem) => blockItem.block_height
      );
      Object.assign(record, { blockIds, blockNumbers });
      return { record, pending: false, message: "transaction mined" };
    } catch (error) {
      Object.assign(record, { error: (error as Error).toString() });
      log("provider error", record);
      return { record, pending: true, message: "" };
    }
  }

  async processRecord(
    record: Rec
  ): Promise<{ record: Rec; pending: boolean; message: string }> {
    // check if it is already broadcasted
    if (!record.transaction) {
      return this.broadcastTransaction(record);
    }

    // search transaction id
    const result = await this.searchTransactionId(record);
    if (!result.pending) return result;

    // not found. Check if it's time to retry
    if (Date.now() > record.sendTime! + this.txWaitingTime) {
      record.availableRetries -= 1;
      return this.broadcastTransaction(record, true);
    }

    // wait and check later
    return { record, pending: true, message: "transaction not mined yet" };
  }

  async processNext(): Promise<void> {
    const rec = this.records.shift();
    if (!rec) return;
    const { record, pending, message } = await this.processRecord(rec);
    log(message, record);
    if (pending) {
      // bring back to the queue again
      this.records.push(record);
    }
  }
}
