import { PICSY } from './picsy';
import { DATA_DIR } from '../settings';
import { join } from 'path';
import { copyFileSync, existsSync, readFileSync, rm, rmSync, writeFileSync } from 'fs';
import { getLogger } from '../logging';
import { ScheduledTask, schedule } from 'node-cron';

const META_FILE = join(DATA_DIR, 'metadata');
const DATA_FILE = join(DATA_DIR, 'matrix');

const logger = getLogger('picsy.manager');

export default class PICSYManager {
  private static instance: PICSYManager | null = null;
  private picsy: PICSY | null = null;
  private tasks: ScheduledTask[] = [];

  private constructor() { }

  static async getInstance() {
    if (this.instance === null) {
      this.instance = new PICSYManager();
      await this.instance.initialize();
    }
    return this.instance;
  }

  async load() {
    const metaswap = META_FILE + '.swp';
    const matswap = DATA_FILE + '.swp';
    const flagfile = DATA_FILE + '.lock';

    if (existsSync(flagfile)) {
      logger.warn('swap files may exist, trying to recover them...');

      if (existsSync(metaswap)) {
        logger.warn('metadata swap file exists, recovering...');
        copyFileSync(metaswap, META_FILE);
        rmSync(metaswap);
      }

      if (existsSync(matswap)) {
        logger.warn('matrix swap file exists, recovering...');
        copyFileSync(matswap, DATA_FILE);
        rmSync(matswap);
      }

      rmSync(flagfile);
    }

    if (!existsSync(META_FILE) || !existsSync(DATA_FILE)) {
      logger.warn('PICSY data not found, creating new PICSY...');
      this.picsy = new PICSY(0, {}, 0.005);
      logger.warn('new PICSY created.');
      return;
    }

    const meta = new Blob([readFileSync(META_FILE)], { type: 'application/json' });
    const mat = new Blob([readFileSync(DATA_FILE)], { type: 'application/octet-stream' });

    this.picsy = await PICSY.fromBlobs(mat, meta);
  }

  async save() {
    if (this.picsy === null) {
      throw new Error('PICSY not initialized');
    }

    const metaswap = META_FILE + '.swp';
    const matswap = DATA_FILE + '.swp';
    const flagfile = DATA_FILE + '.lock';

    const { mat, meta } = this.picsy.toBlobs();

    // crash-safe write
    writeFileSync(metaswap, Buffer.from(await meta.arrayBuffer()), { flag: 'w' });
    writeFileSync(matswap, Buffer.from(await mat.arrayBuffer()), { flag: 'w' });
    // create a marker denotes swap file was written
    writeFileSync(flagfile, '', { flag: 'w' });

    // swap
    rmSync(META_FILE);
    copyFileSync(metaswap, META_FILE);
    rmSync(metaswap);

    rmSync(DATA_FILE);
    copyFileSync(matswap, DATA_FILE);
    rmSync(matswap);

    // remove the marker if swap was successful
    rmSync(flagfile);
  }

  async initialize() {
    await this.load();

    this.cancelTasks();

    this.tasks.push(schedule('0 0 * * *', () => {
      logger.info('recalculating evaluations...');
      if (this.picsy === null) {
        logger.error('PICSY not initialized');
        return;
      }
      this.picsy.recalculateEvaluations();
      logger.info('evaluations updated.');
    }));

    this.tasks.push(schedule('0 */15 * * *', async () => {
      logger.info('saving PICSY data...');
      await this.save();
      logger.info('PICSY data saved.');
    }));
  }

  cancelTasks() {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
  }

  transfer(from: string, to: string, amount: number) {
    if (this.picsy === null) {
      throw new Error('PICSY not initialized');
    }

    if (!this.picsy.joined(from)) {
      this.picsy.addPerson(from);
    }

    if (!this.picsy.joined(to)) {
      this.picsy.addPerson(to);
    }

    this.picsy.transfer(from, to, amount);
  }

  get evaluation(): Record<string, number> {
    if (this.picsy === null) {
      throw new Error('PICSY not initialized');
    }

    const evals = this.picsy.evaluation;
    const ret = {} as Record<string, number>;

    for (const id in this.picsy.ids) {
      ret[id] = evals[this.picsy.ids[id]];
    }

    return ret;
  }
}
