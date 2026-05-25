import fs from 'fs';
import path from 'path';

type Operation = {
  op: 'PUT' | 'DEL';
  key: string;
  value?: string;
  timestamp: number;
};

export class KVStore {
  private memtable: Map<string, string> = new Map();
  private walfd: number;
  private walPath: string;

  constructor(dbDir: string) {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.walPath = path.join(dbDir, 'wal.log');
    
    // Recover from WAL on startup
    if (fs.existsSync(this.walPath)) {
      const content = fs.readFileSync(this.walPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry: Operation = JSON.parse(line);
          if (entry.op === 'PUT' && entry.value !== undefined) {
            this.memtable.set(entry.key, entry.value);
          } else if (entry.op === 'DEL') {
            this.memtable.delete(entry.key);
          }
        } catch (e) {
          console.warn('Corrupted WAL line:', line);
        }
      }
    }

    // Open WAL in append mode for durable writes
    this.walfd = fs.openSync(this.walPath, 'a');
  }

  public async put(key: string, value: string): Promise<void> {
    const entry: Operation = { op: 'PUT', key, value, timestamp: Date.now() };
    await this.appendWAL(entry);
    this.memtable.set(key, value);
  }

  public async get(key: string): Promise<string | null> {
    return this.memtable.get(key) ?? null;
  }

  public async del(key: string): Promise<void> {
    const entry: Operation = { op: 'DEL', key, timestamp: Date.now() };
    await this.appendWAL(entry);
    this.memtable.delete(key);
  }

  public async getWALContents(): Promise<string[]> {
    if (!fs.existsSync(this.walPath)) return [];
    return fs.readFileSync(this.walPath, 'utf8').split('\n').filter(Boolean);
  }

  public async getAll(): Promise<Record<string, string>> {
     const res: Record<string, string> = {};
     for (const [k, v] of this.memtable.entries()) {
        res[k] = v;
     }
     return res;
  }

  private appendWAL(entry: Operation): Promise<void> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(entry) + '\n';
      // Append to file, then flush to disk (fsync)
      fs.write(this.walfd, data, (err) => {
        if (err) return reject(err);
        fs.fsync(this.walfd, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  }

  /**
   * Rewrite WAL by taking an authoritative snapshot of the current Memory Table.
   * Discards all previous logs to save disk space, replacing them with a flat PUT list.
   */
  public async compact(): Promise<void> {
    const newWalPath = this.walPath + '.new';
    const newFd = fs.openSync(newWalPath, 'w');
    
    for (const [key, value] of this.memtable.entries()) {
      const entry: Operation = { op: 'PUT', key, value, timestamp: Date.now() };
      const data = JSON.stringify(entry) + '\n';
      fs.writeSync(newFd, data);
    }
    fs.fsyncSync(newFd);
    fs.closeSync(newFd);
    
    // Atomic rename over the old WAL
    fs.closeSync(this.walfd);
    fs.renameSync(newWalPath, this.walPath);
    
    // Reopen
    this.walfd = fs.openSync(this.walPath, 'a');
  }
}
