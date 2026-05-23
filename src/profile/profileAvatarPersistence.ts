const DB_NAME = 'cutline-profile'
const DB_VERSION = 1
const STORE_NAME = 'avatar'
const AVATAR_KEY = 'user'
const BANNER_KEY = 'user-banner'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

export async function saveProfileBanner(dataUrl: string | null): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      if (dataUrl === null) {
        store.delete(BANNER_KEY)
      } else {
        store.put(dataUrl, BANNER_KEY)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    })
    db.close()
  } catch (err) {
    console.warn('[profile] failed to save banner', err)
  }
}

export async function loadProfileBanner(): Promise<string | null> {
  try {
    const db = await openDb()
    const value = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(BANNER_KEY)
      request.onsuccess = () => {
        const result = request.result
        resolve(typeof result === 'string' ? result : null)
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB read failed'))
    })
    db.close()
    return value
  } catch (err) {
    console.warn('[profile] failed to load banner', err)
    return null
  }
}

export async function saveProfileAvatar(dataUrl: string | null): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      if (dataUrl === null) {
        store.delete(AVATAR_KEY)
      } else {
        store.put(dataUrl, AVATAR_KEY)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    })
    db.close()
  } catch (err) {
    console.warn('[profile] failed to save avatar', err)
  }
}

export async function loadProfileAvatar(): Promise<string | null> {
  try {
    const db = await openDb()
    const value = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(AVATAR_KEY)
      request.onsuccess = () => {
        const result = request.result
        resolve(typeof result === 'string' ? result : null)
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB read failed'))
    })
    db.close()
    return value
  } catch (err) {
    console.warn('[profile] failed to load avatar', err)
    return null
  }
}
