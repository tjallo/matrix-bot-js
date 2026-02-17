export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  update<T>(
    key: string,
    updater: (current: T) => T,
    defaultValue: T,
  ): Promise<T>;
  flush(): Promise<void>;
}
