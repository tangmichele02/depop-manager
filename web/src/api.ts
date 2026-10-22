import type { FeeSettings, Group, Item, Photo, PriceChange } from '../../shared/types';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export interface ItemDetail {
  item: Item;
  photos: Photo[];
  price_history: PriceChange[];
}

export const api = {
  items: (params: { status?: string; group_id?: number; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.group_id) qs.set('group_id', String(params.group_id));
    if (params.q) qs.set('q', params.q);
    return request<Item[]>('GET', `/api/items?${qs}`);
  },
  item: (id: number) => request<ItemDetail>('GET', `/api/items/${id}`),
  createItem: (body: unknown) => request<Item>('POST', '/api/items', body),
  updateItem: (id: number, body: unknown) => request<Item>('PATCH', `/api/items/${id}`, body),
  deleteItem: (id: number) => request<void>('DELETE', `/api/items/${id}`),

  uploadPhotos: (itemId: number, files: FileList | File[]) => {
    const form = new FormData();
    for (const f of Array.from(files)) form.append('photos', f);
    return request<Photo[]>('POST', `/api/items/${itemId}/photos`, form);
  },
  reorderPhotos: (itemId: number, ids: number[]) =>
    request<Photo[]>('PUT', `/api/items/${itemId}/photos/order`, { ids }),
  updatePhoto: (id: number, body: { is_cover?: true; kind?: string }) => request<Photo[]>('PATCH', `/api/photos/${id}`, body),
  deletePhoto: (id: number) => request<Photo[]>('DELETE', `/api/photos/${id}`),

  groups: () => request<Group[]>('GET', '/api/groups'),
  createGroup: (name: string, description: string | null) => request<Group[]>('POST', '/api/groups', { name, description }),
  updateGroup: (id: number, name: string, description: string | null) =>
    request<Group[]>('PATCH', `/api/groups/${id}`, { name, description }),
  deleteGroup: (id: number) => request<Group[]>('DELETE', `/api/groups/${id}`),

  fees: () => request<FeeSettings>('GET', '/api/settings/fees'),
  saveFees: (fees: FeeSettings) => request<FeeSettings>('PUT', '/api/settings/fees', fees),

  backupInfo: () => request<{ backup_dir: string }>('GET', '/api/backup'),
  backup: () => request<{ path: string; photo_count: number }>('POST', '/api/backup'),
};
