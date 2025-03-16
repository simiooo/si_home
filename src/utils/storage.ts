import Dexie, { Entity, EntityTable } from "dexie";
import { Groups } from "../App";
class TabData extends Entity<ConfigDB> {
  id!: number;
  data!: Groups[];
}
class ConfigDB extends Dexie {
  tabData!: EntityTable<TabData, "id">;

  constructor() {
    super("ConfigDB");
    this.version(1).stores({
      tabData: "++id, data", // Primary key and indexed props
    });
    this.tabData.mapToClass(TabData);
  }
}
const db = new ConfigDB();

async function save(data: { tabData: Groups[] }) {
  if (!chrome.storage) {
    db.tabData.add({ data: data?.tabData });
  } else {
    return await chrome.storage.local.set(data);
  }
}
async function get(id?: string) {
  if (!chrome.storage) {
    return {
      tabData: (await db.tabData.get((await db.tabData.count()) - 1))?.data,
    };
  }
  return await chrome.storage.local.get(id);
}

export class ConfigStorage {
  static save = save;
  static get = get;
}
