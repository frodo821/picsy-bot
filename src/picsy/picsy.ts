import { dgeev, NoEigenvector, Eigenvector } from "nlapack";
import { SqMat2d } from "./mat2d";
import { getLogger } from "../logging";

const logger = getLogger('picsy.core');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function eig(m: SqMat2d) {
  const data = m.data;
  const wreal = new Float64Array(m.size);
  const wimag = new Float64Array(m.size);
  const vl = new Float64Array(m.size * m.size);
  const vr = new Float64Array(m.size * m.size);
  dgeev(NoEigenvector, Eigenvector, m.size, data, m.size, wreal, wimag, vl, m.size, vr, m.size)

  return {
    wreal,
    wimag,
    eigenvector: new SqMat2d(vr, m.size),
  }
}

export class PICSY {
  private _val: SqMat2d;
  private _ids: Record<string, number>;
  private _eig: Float64Array | null = null;
  private _lastPaid: Record<number, Record<number, number>> = {};
  private _decay: number;

  /**
   * initialize a new PICSY instance
   * @param n number of participants
   * @param ids participant ids
   * @param decay dacaying rate of paid amount per day
   */
  constructor(n: number, ids: Record<string, number>, decay = 0.01) {
    this._val = SqMat2d.eye(n);
    this._ids = ids;
    this._decay = decay;
  }

  toBlobs() {
    const mat = this._val.toBlob();
    const meta = new Blob([JSON.stringify({
      ids: this._ids,
      size: this._val.size,
      lastPaid: this._lastPaid,
      decay: this._decay,
    })], { type: 'application/json' });
    return { mat, meta };
  }

  static async fromBlobs(mat: Blob, meta: Blob): Promise<PICSY> {
    const { ids, lastPaid, decay } = JSON.parse(await meta.text());
    const picsy = new PICSY(0, {}, decay);

    picsy._ids = ids;
    picsy._val = await SqMat2d.fromBlob(mat);
    picsy._eig = null;
    picsy._lastPaid = lastPaid;

    return picsy;
  }

  private calcDecay() {
    const ret = SqMat2d.zeros(this._val.size);
    const now = Date.now();
    for (const fromIdx in this._lastPaid) {
      for (const toIdx in this._lastPaid[fromIdx]) {
        const last = this._lastPaid[fromIdx][toIdx];
        const elapsed = now - last;
        ret.set(+fromIdx, +toIdx, this._val.get(+fromIdx, +toIdx) * Math.pow(1 - this._decay, elapsed / MS_PER_DAY));
      }
    }

    for (let i = 0; i < ret.size; i++) {
      ret.set(i, i, 1.0);
    }

    return ret;
  }

  private normalized() {
    const v = this.calcDecay();
    logger.info(`decay matrix: \n${v}`);

    const sum = v.sum(0);

    logger.info(`rowwise sum: \n${sum}`);

    for (let i = 0; i < sum.length; i++) {
      if (sum[i] === 0) {
        sum[i] = 1;
      }
    }

    const ret = v.div(sum, 0);

    logger.info(`normalized evaluation matrix: \n${ret}`);

    return ret;
  }

  private updateEig() {
    if (this._val.size === 0) {
      this._eig = new Float64Array(0);
      return;
    }

    const { wreal, wimag, eigenvector } = eig(SqMat2d.fromMat2d(this.normalized()));

    console.log(wreal, wimag);
    console.log(eigenvector.toString());

    let idx = 0;
    let md = Infinity;
    for (let i = 1; i < wreal.length; i++) {
      const dist = Math.abs(1.0 - Math.sqrt(wreal[i] ** 2 + wimag[i] ** 2));
      if (dist < md) {
        idx = i;
        md = dist;
      }
    }

    this._eig = eigenvector.row(idx);
  }

  recalculateEvaluations() {
    this.updateEig();
  }

  get evaluation(): Float64Array {
    if (!this._eig) {
      this.updateEig();
    }
    return this._eig!;
  }

  joined(id: string): boolean {
    return id in this._ids;
  }

  get ids(): Record<string, number> {
    return this._ids;
  }

  addPerson(id: string) {
    this._val = this._val.extendEye(1);
    this._ids[id] = this._val.size - 1;
    this._eig = null;
  }

  transfer(from: string, to: string, amount: number) {
    const fromIdx = this._ids[from];
    const toIdx = this._ids[to];
    const last = this._lastPaid[fromIdx]?.[toIdx] ?? 0;
    const now = Date.now();
    const elapsed = now - last;

    if (amount <= 0) {
      throw new Error('cannot transfer non-positive amount');
    }

    if (fromIdx === undefined || toIdx === undefined) {
      throw new Error('invalid id');
    }

    if (fromIdx === toIdx) {
      throw new Error('cannot transfer to self');
    }

    if (!this._lastPaid[fromIdx]) {
      this._lastPaid[fromIdx] = {};
    }

    this._lastPaid[fromIdx][toIdx] = now;
    this._val.set(fromIdx, toIdx, this._val.get(fromIdx, toIdx) * Math.pow(1 - this._decay, elapsed / MS_PER_DAY) + amount);
    this._eig = null;

    logger.info(`\n${this._val}`);
  }
}
