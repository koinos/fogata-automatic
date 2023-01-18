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
  ): Promise<{ record: Rec; pending: boolean }> {
    try {
      if (record.availableRetries <= 0) {
        log("record with no more retries", record);
        return { record, pending: false };
      }
      log(
        isRetry ? "retry: processing operations" : "processing new operations",
        record
      );
      const tx = await this.signer.prepareTransaction({
        operations: record.operations,
      });
      log("transaction created", tx);
      const { transaction, receipt } = await this.signer.sendTransaction(tx);
      Object.assign(record, { transaction, receipt, sendTime: Date.now() });
      log("transaction submitted", record);
      return { record, pending: true };
    } catch (error) {
      const availableRetries = record.availableRetries - 1;
      Object.assign(record, {
        error: (error as Error).toString(),
        availableRetries,
      });
      log("transaction error", record);
      const pending = availableRetries > 0;
      if (!pending) log("no more retries", record);
      return { record, pending };
    }
  }

  async searchTransactionId(record: Rec): Promise<boolean> {
    const { transactions: txs } =
      await this.signer.provider!.getTransactionsById([
        record.transaction!.id!,
      ]);
    if (!txs || !txs[0] || txs[0].containing_blocks) return false;

    const { containing_blocks: blockIds } = txs[0];
    const blocks = await this.signer.provider!.getBlocksById(blockIds);
    const blockNumbers = blocks.block_items.map(
      (blockItem) => blockItem.block_height
    );
    Object.assign(record, { blockIds, blockNumbers });
    log("transaction mined", record);
    // not added to the queue
    return true;
  }

  async processRecord(record: Rec): Promise<{ record: Rec; pending: boolean }> {
    if (!record.transaction) {
      return this.broadcastTransaction(record);
    }

    // search transaction id
    try {
      const found = await this.searchTransactionId(record);
      if (found) return { record, pending: false };
    } catch (error) {
      Object.assign(record, { error: (error as Error).toString() });
      log("provider error", record);
    }

    // not found. Check if it's time to retry
    if (Date.now() > record.sendTime! + this.txWaitingTime) {
      record.availableRetries -= 1;
      return this.broadcastTransaction(record, true);
    }

    // wait and check later
    log("transaction not mined yet", record);
    return { record, pending: true };
  }

  async processNext(): Promise<void> {
    const rec = this.records.shift();
    if (!rec) return;
    const { record, pending } = await this.processRecord(rec);
    if (pending) {
      // bring back to the queue again
      this.records.push(record);
    }
  }
}
