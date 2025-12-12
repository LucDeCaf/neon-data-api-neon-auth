import {
  AbstractPowerSyncDatabase,
  LogLevel,
  PowerSyncBackendConnector,
  type PowerSyncCredentials,
  PowerSyncDatabase,
  Schema,
  Table,
  column,
  createBaseLogger,
} from "@powersync/web";
import { client } from "@/lib/auth";

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

export const AppSchema = new Schema({
  notes,
  paragraphs,
});

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
        endpoint: 'https://693c551e7e2a07e6df7bec67.powersync.journeyapps.com',
        token: session.data?.session.token ?? ''
    } satisfies PowerSyncCredentials;
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    console.log('uploadDataNOOP');
  }
}

const connector = new PowerSyncConnector();

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: "powersync.db",
  },
});

let isInitialized = false;

export async function connectPowerSync() {
  if (isInitialized) {
    return;
  }
  await powersync.connect(connector);
  isInitialized = true;
}

export async function disconnectPowerSync() {
  await powersync.disconnect();
  isInitialized = false;
}