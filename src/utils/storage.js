// --- Storage-related utility functions extracted from App.jsx ---

// --- Constants ---
const AUTOSAVE_META_KEY = 'tapnow_autosave_meta';
const AUTOSAVE_IDB_NAME = 'tapnow_autosave_db';
const AUTOSAVE_IDB_STORE = 'autosave';
const AUTOSAVE_IDB_KEY = 'latest';

// --- V3.5.16: LocalImageManager - IndexedDB-based image storage ---
// Replaces localStorage Base64 storage with IndexedDB for better performance and larger capacity
export const LocalImageManager = (() => {
    const DB_NAME = 'tapnow_images_db';
    const DB_VERSION = 1;
    const STORE_NAME = 'images';
    let dbInstance = null;
    let dbInitPromise = null;
    const blobUrlCache = new Map(); // Cache: id -> blobUrl

    const initDB = () => {
        if (dbInitPromise) return dbInitPromise;

        dbInitPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('[LocalImageManager] IndexedDB not supported, falling back to memory');
                resolve(null);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('[LocalImageManager] IndexedDB init failed:', event.target.error);
                resolve(null);
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                console.log('[LocalImageManager] IndexedDB initialized');
                resolve(dbInstance);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('[LocalImageManager] Object store created');
                }
            };
        });

        return dbInitPromise;
    };

    // Generate unique ID for image
    const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Save image (Base64 or Blob) to IndexedDB
    const saveImage = async (data, existingId = null) => {
        const db = await initDB();
        if (!db) return null;

        const id = existingId || generateId();

        return new Promise((resolve, reject) => {
            try {
                let blob;
                if (typeof data === 'string' && data.startsWith('data:')) {
                    // Convert Base64 to Blob
                    const parts = data.split(',');
                    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
                    const binaryStr = atob(parts[1]);
                    const bytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                        bytes[i] = binaryStr.charCodeAt(i);
                    }
                    blob = new Blob([bytes], { type: mime });
                } else if (data instanceof Blob) {
                    blob = data;
                } else {
                    console.warn('[LocalImageManager] Invalid data type for saveImage');
                    resolve(null);
                    return;
                }

                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const record = {
                    id,
                    blob,
                    timestamp: Date.now(),
                    size: blob.size
                };

                const request = store.put(record);

                request.onsuccess = () => {
                    resolve(id);
                };

                request.onerror = (event) => {
                    console.error('[LocalImageManager] Save failed:', event.target.error);
                    resolve(null);
                };
            } catch (err) {
                console.error('[LocalImageManager] Save error:', err);
                resolve(null);
            }
        });
    };

    // Get image as Blob URL from IndexedDB
    const getImage = async (id) => {
        // Check cache first
        if (blobUrlCache.has(id)) {
            return blobUrlCache.get(id);
        }

        const db = await initDB();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(id);

                request.onsuccess = () => {
                    const record = request.result;
                    if (record && record.blob) {
                        const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
                        if (!isFileProtocol) {
                            const objectUrl = URL.createObjectURL(record.blob);
                            blobUrlCache.set(id, objectUrl);
                            resolve(objectUrl);
                            return;
                        }

                        // file:// 模式下仍然回退到 Data URL，避免 blob:null 安全限制
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const base64 = reader.result;
                            blobUrlCache.set(id, base64);
                            resolve(base64);
                        };
                        reader.onerror = () => {
                            console.error('[LocalImageManager] Failed to convert blob to base64');
                            resolve(null);
                        };
                        reader.readAsDataURL(record.blob);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => resolve(null);
            } catch (err) {
                console.error('[LocalImageManager] Get error:', err);
                resolve(null);
            }
        });
    };

    // Delete image from IndexedDB
    const deleteImage = async (id) => {
        const db = await initDB();
        if (!db) return false;

        // Revoke cached blob URL (only if it is a blob url)
        if (blobUrlCache.has(id)) {
            const url = blobUrlCache.get(id);
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
            blobUrlCache.delete(id);
        }

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    };

    // Get storage stats
    const getStats = async () => {
        const db = await initDB();
        if (!db) return { count: 0, totalSize: 0 };

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const records = request.result || [];
                const totalSize = records.reduce((sum, r) => sum + (r.size || 0), 0);
                resolve({ count: records.length, totalSize });
            };

            request.onerror = () => resolve({ count: 0, totalSize: 0 });
        });
    };

    // Check if ID is an image reference
    const isImageId = (str) => typeof str === 'string' && str.startsWith('img_');

    // V3.7.19: Removed auto-init on module load - now lazy-loaded on first use
    // initDB();

    return { saveImage, getImage, deleteImage, getStats, isImageId, initDB };
})();

// -> blobUrlCache exported internally for use within this module

// --- Auto-save helpers ---

export const openAutoSaveDb = () => {
    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB not available'));
    }
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(AUTOSAVE_IDB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(AUTOSAVE_IDB_STORE)) {
                db.createObjectStore(AUTOSAVE_IDB_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });
};

export const readAutoSaveFromIdb = async () => {
    try {
        const db = await openAutoSaveDb();
        return await new Promise((resolve) => {
            const tx = db.transaction(AUTOSAVE_IDB_STORE, 'readonly');
            const store = tx.objectStore(AUTOSAVE_IDB_STORE);
            const req = store.get(AUTOSAVE_IDB_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
            tx.oncomplete = () => db.close();
            tx.onerror = () => db.close();
        });
    } catch (e) {
        return null;
    }
};

export const writeAutoSaveToIdb = async (payload) => {
    const db = await openAutoSaveDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(AUTOSAVE_IDB_STORE, 'readwrite');
        const store = tx.objectStore(AUTOSAVE_IDB_STORE);
        const req = store.put(payload, AUTOSAVE_IDB_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error('IndexedDB write failed'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
    });
};

export const readAutoSaveMeta = () => {
    try {
        const raw = localStorage.getItem(AUTOSAVE_META_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
};

export const writeAutoSaveMeta = (meta) => {
    try {
        localStorage.setItem(AUTOSAVE_META_KEY, JSON.stringify(meta));
    } catch (e) { }
};
