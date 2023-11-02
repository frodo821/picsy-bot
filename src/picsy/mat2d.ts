export class Mat2d {
  protected _data: Float64Array;
  protected readonly _shape: readonly [number, number];

  constructor(data: Float64Array, shape: readonly [number, number]) {
    if (data.length !== shape[0] * shape[1]) {
      throw new Error(`data length ${data.length} does not match shape ${shape}`);
    }

    this._data = data;
    this._shape = shape;
  }

  get data(): Float64Array {
    const ret = new Float64Array(this._data.length);
    ret.set(this._data);
    return ret;
  }

  get shape(): readonly [number, number] {
    return [this._shape[0], this._shape[1]] as const;
  }

  toBlob(): Blob {
    const size = new BigUint64Array(2);
    size[0] = BigInt(this._shape[0]);
    size[1] = BigInt(this._shape[1]);
    return new Blob([size, this._data], { type: 'application/octet-stream' });
  }

  static async fromBlob(blob: Blob): Promise<Mat2d> {
    const buffer = await blob.arrayBuffer();
    const size = new BigUint64Array(buffer.slice(0, 16));
    const data = new Float64Array(buffer.slice(16));
    return new Mat2d(data, [Number(size[0]), Number(size[1])]);
  }

  extendZeros(n: number, m: number): Mat2d {
    const shape = [this._shape[0] + n, this._shape[1] + m] as const;
    const data = new Float64Array(shape[0] * shape[1]);

    for (let i = 0; i < this._shape[0]; i++) {
      data.set(this._data.subarray(this._shape[0] * i, this.shape[0] * (i + 1)), shape[0] * i);
    }

    return new Mat2d(data, shape);
  }

  protected validateIndex(r: number, c: number): void {
    if (r < 0 || r >= this._shape[0]) throw new Error(`row index out of range: ${r}`);
    if (c < 0 || c >= this._shape[1]) throw new Error(`column index out of range: ${c}`);
  }

  get(r: number, c: number): number {
    this.validateIndex(r, c);
    return this._data[this._shape[0] * r + c];
  }

  set(r: number, c: number, v: number): void {
    this.validateIndex(r, c);
    this._data[this._shape[0] * r + c] = v;
  }

  row(r: number): Float64Array {
    if (r < 0 || r >= this._shape[0]) throw new Error(`row index out of range: ${r}`);

    return this._data.subarray(this._shape[0] * r, this._shape[0] * (r + 1));
  }

  setRow(r: number, data: Float64Array): void {
    if (r < 0 || r >= this._shape[0]) throw new Error(`row index out of range: ${r}`);
    if (data.length !== this._shape[1]) throw new Error(`data length ${data.length} does not match shape ${this._shape}`);

    this._data.set(data, this._shape[0] * r);
  }

  col(c: number): Float64Array {
    if (c < 0 || c >= this._shape[1]) throw new Error(`column index out of range: ${c}`);

    const data = new Float64Array(this._shape[0]);
    for (let i = 0; i < this._shape[0]; i++) {
      data[i] = this._data[this._shape[0] * i + c];
    }
    return data;
  }

  setCol(c: number, data: Float64Array): void {
    if (c < 0 || c >= this._shape[1]) throw new Error(`column index out of range: ${c}`);
    if (data.length !== this._shape[0]) throw new Error(`data length ${data.length} does not match shape ${this._shape}`);

    for (let i = 0; i < this._shape[0]; i++) {
      this._data[this._shape[0] * i + c] = data[i];
    }
  }

  /**
   * multiply each element of this matrix with another value
   * @param value multiplier
   * @param axis multiply along this axis. 1 for each column, 0 for each row. defaults to 1. if value is a number, this parameter is ignored.
   * @returns a new Mat2d
   */
  mul(value: number | Float64Array, axis?: number) {
    if (typeof value === 'number') {
      const data = new Float64Array(this._data.length);
      data.set(this._data.map(v => v * value));
      return new Mat2d(data, this._shape);
    }

    axis = axis ?? 1;

    if (value.length !== this._shape[axis]) {
      throw new Error(`data length ${value.length} does not match shape ${this._shape}`);
    }

    if (axis === 1) {
      return new Mat2d(this._data.map((v, i) => v * value[i % this._shape[1]]), this._shape);
    } else if (axis === 0) {
      return new Mat2d(this._data.map((v, i) => v * value[Math.floor(i / this._shape[1])]), this._shape);
    } else {
      throw new Error(`axis out of range: ${axis}`);
    }
  }

  /**
   * @param axis axis to calculate sum. 1 for each column, 0 for each row, 2 for all. defaults to 1
   * @returns a Float64Array of sum values
   */
  sum(axis?: number): Float64Array {
    if (axis === undefined || axis === null || axis === 1) {
      const data = new Float64Array(this._shape[1]);
      for (let i = 0; i < this._shape[1]; i++) {
        data[i] = this.col(i).reduce((a, b) => a + b, 0);
      }
      return data;
    } else if (axis === 0) {
      const data = new Float64Array(this._shape[0]);
      for (let i = 0; i < this._shape[0]; i++) {
        data[i] = this.row(i).reduce((a, b) => a + b, 0);
      }
      return data;
    } else if (axis === 2) {
      const data = new Float64Array(1);
      data.set([this._data.reduce((a, b) => a + b, 0)]);
      return data;
    } else {
      throw new Error(`axis out of range: ${axis}`);
    }
  }

  /**
   * @param axis axis to calculate mean. 1 for each column, 0 for each row, 2 for all. defaults to 1
   * @returns a Float64Array of mean values
   */
  mean(axis?: number): Float64Array {
    if (axis === undefined || axis === null || axis === 1) {
      const data = new Float64Array(this._shape[1]);
      for (let i = 0; i < this._shape[1]; i++) {
        data[i] = this.col(i).reduce((a, b) => a + b, 0) / this._shape[0];
      }
      return data;
    } else if (axis === 0) {
      const data = new Float64Array(this._shape[0]);
      for (let i = 0; i < this._shape[0]; i++) {
        data[i] = this.row(i).reduce((a, b) => a + b, 0) / this._shape[1];
      }
      return data;
    } else if (axis === 2) {
      const data = new Float64Array(1);
      data.set([this._data.reduce((a, b) => a + b, 0) / (this._shape[0] * this._shape[1])]);
      return data;
    } else {
      throw new Error(`axis out of range: ${axis}`);
    }
  }

  toString(): string {
    if (this._shape[0] === 0 || this._shape[1] === 0) {
      return '()';
    }

    if (this.shape[0] === 1) {
      return `(${this.row(0).join(', ')})`;
    }

    const lparen = ['⎛', '⎜', '⎝'];
    const rparen = ['⎞', '⎟', '⎠'];
    const values = [] as string[][];

    for (let i = 0; i < this.shape[0]; i++) {
      values.push(Array.from(this.row(i)).map(it => it.toString()));
    }

    const maxlen = Math.max(...values.map(it => Math.max(...it.map(it => it.length))));

    const v = values.map(row => row.map(it => it.padStart(maxlen, ' ')).join(' '));
    const last = v.pop()!;
    const first = v.shift()!;
    const middle = v.map(row => `${lparen[1]}${row}${rparen[1]}`).join('\n');
    return `${lparen[0]}${first}${rparen[0]}\n${middle}\n${lparen[2]}${last}${rparen[2]}`;
  }

  reshape(shape: readonly [number, number]): Mat2d {
    if (this._shape[0] * this._shape[1] !== shape[0] * shape[1]) {
      throw new Error(`cannot reshape ${this._shape} to ${shape}`);
    }

    return new Mat2d(this._data, shape);
  }

  static eye(n: number): Mat2d {
    const data = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      data[i * n + i] = 1;
    }
    return new Mat2d(data, [n, n]);
  }
}

export class SqMat2d extends Mat2d {
  constructor(data: Float64Array, size: number) {
    super(data, [size, size]);
  }

  extendEye(n: number): SqMat2d {
    if (this.size === 0) {
      return SqMat2d.eye(n);
    }

    const m = SqMat2d.fromMat2d(this.extendZeros(n, n));

    for (let i = this._shape[0] - 1; i < m._shape[0]; i++) {
      m.set(i, i, 1.0);
    }

    return m;
  }

  get size(): number {
    return this._shape[0];
  }

  static eye(n: number): SqMat2d {
    const data = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      data[i * n + i] = 1;
    }
    return new SqMat2d(data, n);
  }

  static zeros(n: number): SqMat2d {
    return new SqMat2d(new Float64Array(n * n), n);
  }

  static fromMat2d(m: Mat2d): SqMat2d {
    if (m.shape[0] !== m.shape[1]) {
      throw new Error(`cannot convert ${m.shape} to SqMat2d`);
    }
    return new SqMat2d(m.data, m.shape[0]);
  }

  static async fromBlob(blob: Blob): Promise<SqMat2d> {
    return SqMat2d.fromMat2d(await Mat2d.fromBlob(blob));
  }
}
