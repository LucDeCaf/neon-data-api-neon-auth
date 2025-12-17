import {
  AbstractPowerSyncDatabase,
  LogLevel,
  PowerSyncBackendConnector,
  type PowerSyncCredentials,
  PowerSyncDatabase,
  Schema,
  Table,
  column,
  createBaseLogger,CrudEntry,UpdateType
} from "@powersync/web";
import { client } from "@/lib/auth";
import { wrapPowerSyncWithDrizzle, DrizzleAppSchema } from '@powersync/drizzle-driver';

import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzleSchema } from "./powersync-schema";


 const FATAL_RESPONSE_CODES: RegExp[] = [];

export const powersyncLogger = createBaseLogger();
powersyncLogger.useDefaults();
powersyncLogger.setLevel(LogLevel.DEBUG);

const notes = new Table(
  {
    // id column (text) is automatically included
    owner_id: column.text,
    title: column.text,
    created_at: column.text,
    updated_at: column.text,
    shared: column.integer,
  },
  { indexes: {} },
);

const paragraphs = new Table(
  {
    // id column (text) is automatically included
    note_id: column.text,
    content: column.text,
    created_at: column.text,
  },
  { indexes: {} },
);

// export const AppSchema = new Schema({
//   notes,
//   paragraphs,
// });

export type Database = (typeof AppSchema)["types"];
export type NoteRecord = Database["notes"];
export type ParagraphRecord = Database["paragraphs"];


export class PowerSyncConnector implements PowerSyncBackendConnector  {
  async fetchCredentials() {
    const session = await client.auth.getSession();
    if (!session) {
      throw new Error('Could not fetch Neon credentials.');
    }
    
    console.log(`powersync jwt = ${session.data?.user.id}`);
    
    return {
        endpoint: import.meta.env.VITE_POWERSYNC_URL,
        token: session.data?.session.token ?? ''
    } satisfies PowerSyncCredentials;
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    let lastOp: CrudEntry | null = null;
    try {
      // Note: If transactional consistency is important, use database functions
      // or edge functions to process the entire transaction in a single call.
      for (const op of transaction.crud) {
        lastOp = op;
        const table = client.from(op.table as any);
        let result: any;
        switch (op.op) {
          case UpdateType.PUT:
            const record = { ...(op.opData as any), id: op.id };
            result = await table.upsert(record as any);
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData as any).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id);
            break;
        }

        if (result.error) {
          console.error(result.error);
          result.error.message = `Could not update Neon. Received error: ${result.error.message}`;
          throw result.error;
        }
      }

      await transaction.complete();
    } catch (ex: any) {
      console.debug(ex);
      if (typeof ex.code == 'string' && FATAL_RESPONSE_CODES.some((regex) => regex.test(ex.code))) {
        /**
         * Instead of blocking the queue with these errors,
         * discard the (rest of the) transaction.
         *
         * Note that these errors typically indicate a bug in the application.
         * If protecting against data loss is important, save the failing records
         * elsewhere instead of discarding, and/or notify the user.
         */
        console.error('Data upload error - discarding:', lastOp, ex);
        await transaction.complete();
      } else {
        // Error may be retryable - e.g. network error or temporary server error.
        // Throwing an error here causes this call to be retried after a delay.
        throw ex;
      }
    }
  }
}

const connector = new PowerSyncConnector();

export const AppSchema = new DrizzleAppSchema(drizzleSchema);

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: "powersync.db",
  },
});

export const powersyncDrizzle = wrapPowerSyncWithDrizzle(powersync);

let isInitialized = false;

export async function connectPowerSync() {
  if (isInitialized) {
    return;
  }
  await powersync.connect(connector);
  isInitialized = true;
  console.log("powersync connected");
}

export async function disconnectPowerSync() {
  await powersync.disconnect();
  isInitialized = false;
}