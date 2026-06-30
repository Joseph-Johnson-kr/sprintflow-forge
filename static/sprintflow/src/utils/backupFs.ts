// File System Access API types not fully covered by lib.dom in TS 5.5
interface FSDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(desc: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(desc: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface FSFileHandle extends FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;

const IDB_DB = 'sprintflow-fs';
const IDB_STORE = 'handles';
const IDB_KEY = 'backup-dir';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirectoryHandle(handle: FSDirectoryHandle): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirectoryHandle(): Promise<FSDirectoryHandle | null> {
  try {
    const db = await openIdb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as FSDirectoryHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * Returns the saved directory handle with current write permission, or null.
 * Must be called from a user-gesture handler (button click) for permission re-prompt.
 */
export async function getDirectory(): Promise<FSDirectoryHandle | null> {
  try {
    const handle = await loadDirectoryHandle();
    if (!handle) return null;
    let perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'prompt') {
      perm = await handle.requestPermission({ mode: 'readwrite' });
    }
    return perm === 'granted' ? handle : null;
  } catch {
    return null;
  }
}

/**
 * Prompts the user to pick a folder, saves the handle, returns it.
 * Returns null if the user cancels.
 */
export async function pickDirectory(): Promise<FSDirectoryHandle | null> {
  try {
    const handle: FSDirectoryHandle = await win.showDirectoryPicker({ mode: 'readwrite' });
    await saveDirectoryHandle(handle);
    return handle;
  } catch {
    return null;
  }
}

/** Write a string to a file inside a directory handle. Creates or overwrites. */
export async function writeToDirectory(
  dir: FSDirectoryHandle,
  filename: string,
  content: string,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Pick a JSON file using the File System Access open file picker.
 * Returns the file text, or null if cancelled.
 */
export async function pickJsonFileFSA(): Promise<string | null> {
  try {
    const [fileHandle]: FSFileHandle[] = await win.showOpenFilePicker({
      types: [{ description: 'SprintFlow Backup', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

/** Fallback: trigger a browser download of a JSON blob. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fallback: open a hidden file input to let the user pick a JSON file. */
export function pickJsonFileViaInput(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    // Resolve null if the user closes without picking (fires after change or after a short delay)
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
