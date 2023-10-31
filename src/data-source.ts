import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { DATA_DIR } from './settings';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: join(DATA_DIR, 'main.db'),
  synchronize: true,
  logging: false,
  entities: [],
  migrations: [],
  subscribers: [],
});

export async function initialize() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}
