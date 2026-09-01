import { openDB } from 'idb';

async function openIndexedDB(dbName: string, storeName: string) {

  if (!process.env.CLIENT) {
    return;
  }

  const db = await openDB(dbName, 1, {
    upgrade(db: any) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    },
  });

  return db;
}

export async function getFromIndexedDB(dbName: string, storeName: string, key: string) {
  if (!process.env.CLIENT) {
    return;
  }


  const db = await openIndexedDB(dbName, storeName);
  if (db) {
    return db.get(storeName, key);
  }
}

export async function setToIndexedDB(dbName: string, storeName: string, key: string, value: any) {
  if (!process.env.CLIENT) {
    return;
  }

  const db = await openIndexedDB(dbName, storeName);
  if (db) {
    return db.put(storeName, value, key);
  }
}

export async function deleteFromIndexedDB(dbName: string, storeName: string, key: string) {
  if (!process.env.CLIENT) {
    return;
  }

  const db = await openIndexedDB(dbName, storeName);
  if (db) {
    return db.delete(storeName, key);
  }
}
