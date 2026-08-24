import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const trackerState = sqliteTable('tracker_state', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});
