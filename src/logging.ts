import c from 'ansi-colors';

export const LevelNames = {
  0: "UNSET",
  10: "DEBUG",
  20: "INFO",
  30: "WARN",
  40: "ERROR",
  50: "FATAL"
} as const;

export const NameLevels = {
  UNSET: 0,
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50
} as const;

export class LogRecord {
  constructor(
    public readonly name: string,
    public readonly level: number,
    public readonly message: string,
    public readonly args: any[],
    public readonly timestamp: Date,
  ) { }
}

export interface Formatter {
  format(record: LogRecord): string;
}

export interface Handler {
  handle(record: LogRecord): void;
}

const defaultFormatter: Formatter = {
  format(record: LogRecord): string {
    const t = record.timestamp.toISOString();
    const ln = `[${LevelNames[record.level as keyof typeof LevelNames] ?? `UNKNOWN (${record.level})`}]`;
    const n = record.name;
    const m = record.message;

    // if (!process.stdout.isTTY) {
    //   return `${t} ${ln} ${n}: ${m}`;
    // }

    let lc = c.gray;

    if (record.level >= NameLevels.FATAL) {
      lc = c.red;
    } else if (record.level >= NameLevels.ERROR) {
      lc = c.redBright;
    } else if (record.level >= NameLevels.WARN) {
      lc = c.yellowBright;
    } else if (record.level >= NameLevels.INFO) {
      lc = c.whiteBright;
    }

    return `${c.gray(t)} ${lc(ln)} ${c.magentaBright(n)}: ${lc(m)}`;
  }
}

export class ConsoleHandler implements Handler {
  private _formatter: Formatter | null = null;

  constructor() {
  }

  handle(record: LogRecord): void {
    const formatter = this._formatter ?? defaultFormatter;
    const message = formatter.format(record);
    console.log(message);
  }

  setFormatter(formatter: Formatter): void {
    this._formatter = formatter;
  }
}

export class Logger {
  private static readonly _loggers: Record<string, Logger> = {};
  static readonly root = new Logger("(root)", NameLevels.INFO, null);

  static {
    if ('LOGLEVEL' in process.env) {
      const level = process.env.LOGLEVEL!;

      if (level in NameLevels) {
        this.root.level = NameLevels[level as keyof typeof NameLevels];
      }

      const lvl = parseInt(level, 10);

      if (!isNaN(lvl) && lvl >= 0) {
        this.root.level = lvl;
      }
    }

    this.root.addHandler(new ConsoleHandler());
  }

  static getLogger(name: string): Logger {
    if (this._loggers[name] === undefined) {
      const i = name.lastIndexOf(".");

      if (i !== -1) {
        const parent = this.getLogger(name.slice(0, i));
        const thisName = name.slice(i + 1);

        this._loggers[name] = new Logger(thisName, NameLevels.UNSET, parent);
      } else {
        this._loggers[name] = new Logger(name, NameLevels.UNSET, this.root);
      }
    }

    return this._loggers[name];
  }

  private handlers: Handler[] = [];

  private constructor(
    public readonly name: string,
    public level: number,
    public parent: Logger | null,
  ) { }

  addHandler(handler: Handler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: Handler): void {
    const i = this.handlers.indexOf(handler);
    if (i !== -1) {
      this.handlers.splice(i, 1);
    }
  }

  get effectiveLevel(): number {
    const levels = [this.level];

    let parent = this.parent;
    while (parent !== null) {
      levels.push(parent.level);
      parent = parent.parent;
    }

    return Math.max(...levels);
  }

  get levelName(): string {
    return LevelNames[this.effectiveLevel as keyof typeof LevelNames] ?? `UNKNOWN (${this.effectiveLevel})`;
  }

  get rootName(): string {
    if (this.parent === null) {
      return "(root)";
    }

    return `${this.parent.rootName}.${this.name}`.replace(/^\(root\)\./, '');
  }

  private propagate(from: Logger, record: LogRecord): void {
    this.handlers.forEach(handler => handler.handle(record));
    this.parent?.propagate(from, record);
  }

  log(level: number, message: unknown, ...args: any[]): void {
    if (level < this.effectiveLevel) {
      return;
    }

    let _message: string;

    if (typeof message === "string") {
      _message = message;
    } else {
      _message = `${message}`;
    }

    const record = new LogRecord(this.rootName, level, _message, args, new Date());
    this.propagate(this, record);
  }

  debug(message: unknown, ...args: any[]): void {
    this.log(NameLevels.DEBUG, message, ...args);
  }

  info(message: unknown, ...args: any[]): void {
    this.log(NameLevels.INFO, message, ...args);
  }

  warn(message: unknown, ...args: any[]): void {
    this.log(NameLevels.WARN, message, ...args);
  }

  error(message: unknown, ...args: any[]): void {
    this.log(NameLevels.ERROR, message, ...args);
  }

  fatal(message: unknown, ...args: any[]): void {
    this.log(NameLevels.FATAL, message, ...args);
  }
}

export const getLogger = Logger.getLogger.bind(Logger);
