import { Injectable } from '@angular/core';

const SID_STORAGE_KEY = 'hse_sid';

@Injectable({ providedIn: 'root' })
export class SidService {
  /** Берём sid из URL или localStorage, если в URL есть — сохраняем */
  ensureSid(): string | null {
    const fromUrl = this.getSidFromUrl();
    if (fromUrl) {
      this.saveSid(fromUrl);
      return fromUrl;
    }
    return this.getSidFromStorage();
  }

  getSidOrThrow(): string {
    const sid = this.ensureSid();
    if (!sid) throw new Error('sid_missing');
    return sid;
  }

  clearSid(): void {
    try {
      window.localStorage.removeItem(SID_STORAGE_KEY);
    } catch {}
  }

  removeSidFromUrl(): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('sid')) return;
    url.searchParams.delete('sid');
    window.history.replaceState({}, document.title, url.toString());
  }

  private getSidFromUrl(): string | null {
    const sp = new URLSearchParams(window.location.search);
    const sid = (sp.get('sid') ?? '').trim();
    return sid || null;
  }

  private saveSid(sid: string): void {
    try {
      window.localStorage.setItem(SID_STORAGE_KEY, sid);
    } catch {}
  }

  private getSidFromStorage(): string | null {
    try {
      const sid = (window.localStorage.getItem(SID_STORAGE_KEY) ?? '').trim();
      return sid || null;
    } catch {
      return null;
    }
  }
}
