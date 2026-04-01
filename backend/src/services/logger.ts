import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

const RING_BUFFER_SIZE = 2000;

class Logger {
  private buffer: LogEntry[] = [];
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
    this._installConsoleIntercept();
  }

  private _log(level: LogLevel, category: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
    this.buffer.push(entry);
    if (this.buffer.length > RING_BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.emitter.emit("entry", entry);
  }

  info(category: string, message: string, data?: unknown): void {
    this._log("INFO", category, message, data);
  }

  warn(category: string, message: string, data?: unknown): void {
    this._log("WARN", category, message, data);
  }

  error(category: string, message: string, data?: unknown): void {
    this._log("ERROR", category, message, data);
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  onEntry(cb: (entry: LogEntry) => void): () => void {
    this.emitter.on("entry", cb);
    return () => this.emitter.off("entry", cb);
  }

  private _installConsoleIntercept(): void {
    const self = this;
    const originalLog = console.log.bind(console);
    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);

    console.log = (...args: unknown[]) => {
      originalLog(...args);
      self._log("INFO", "SYSTEM", args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
      self._log("WARN", "SYSTEM", args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    console.error = (...args: unknown[]) => {
      originalError(...args);
      self._log("ERROR", "SYSTEM", args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
  }
}

export const logger = new Logger();
