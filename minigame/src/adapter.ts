/**
 * Platform adapter: shims Web APIs for the Douyin mini-game environment.
 * Installs document/Image/localStorage/fetch/AudioContext on the global object
 * so the existing game engine code runs unmodified.
 */

declare const tt: any;
declare const GameGlobal: any;

let mainCanvas: any = null;

export function getMainCanvas(): any {
  return mainCanvas;
}

export function initAdapter(): void {
  const g: any =
    typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;

  // ── Main on-screen canvas (first tt.createCanvas call) ──
  mainCanvas = tt.createCanvas();
  const info = tt.getSystemInfoSync();
  mainCanvas.width = info.windowWidth * info.pixelRatio;
  mainCanvas.height = info.windowHeight * info.pixelRatio;

  // ── document shim ──
  g.document = {
    createElement(tag: string): any {
      if (tag === 'canvas') return tt.createCanvas();
      return {
        style: {},
        appendChild() {},
        removeChild() {},
        addEventListener() {},
        removeEventListener() {},
        getContext() {
          return null;
        },
      };
    },
    getElementById() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
    body: { appendChild() {}, style: {}, clientWidth: info.windowWidth, clientHeight: info.windowHeight },
    documentElement: { clientWidth: info.windowWidth, clientHeight: info.windowHeight },
  };

  // ── Image shim ──
  g.Image = class ImageShim {
    private _img: any;
    onload: (() => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    private _src = '';
    constructor() {
      this._img = tt.createImage();
      this._img.onload = () => {
        if (this.onload) this.onload();
      };
      this._img.onerror = (e: any) => {
        if (this.onerror) this.onerror(e);
      };
    }
    get src(): string {
      return this._src;
    }
    set src(v: string) {
      this._src = v;
      this._img.src = v;
    }
    get width(): number {
      return this._img.width;
    }
    set width(v: number) {
      this._img.width = v;
    }
    get height(): number {
      return this._img.height;
    }
    set height(v: number) {
      this._img.height = v;
    }
    get naturalWidth(): number {
      return this._img.width;
    }
    get naturalHeight(): number {
      return this._img.height;
    }
    get complete(): boolean {
      return this._img.complete ?? false;
    }
  };

  // ── localStorage shim ──
  g.localStorage = {
    getItem(key: string): string | null {
      try {
        const v = tt.getStorageSync(key);
        if (v === '' || v === undefined || v === null) return null;
        return typeof v === 'string' ? v : JSON.stringify(v);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        tt.setStorageSync(key, value);
      } catch {}
    },
    removeItem(key: string): void {
      try {
        tt.removeStorageSync(key);
      } catch {}
    },
  };

  // ── fetch shim (XMLHttpRequest is available in mini-game) ──
  if (typeof g.fetch !== 'function') {
    g.fetch = (url: string, _options?: any) =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            arrayBuffer: () => Promise.resolve(xhr.response),
            text: () =>
              Promise.resolve(
                typeof xhr.response === 'string'
                  ? xhr.response
                  : new TextDecoder().decode(xhr.response),
              ),
          });
        };
        xhr.onerror = () => reject(new Error(`fetch failed: ${url}`));
        xhr.send();
      });
  }

  // ── AudioContext shim ──
  const AC: any =
    (typeof tt.createWebAudioContext === 'function' && tt.createWebAudioContext()) ||
    g.AudioContext ||
    g.webkitAudioContext ||
    null;

  // ── window shim ──
  g.window = {
    AudioContext: AC,
    webkitAudioContext: AC,
    devicePixelRatio: info.pixelRatio,
    innerWidth: info.windowWidth,
    innerHeight: info.windowHeight,
    addEventListener() {},
    removeEventListener() {},
  };
  if (AC) {
    g.AudioContext = AC.constructor || AC;
    g.webkitAudioContext = AC.constructor || AC;
  }

  // ── requestAnimationFrame (already global in mini-game, ensure) ──
  if (typeof g.requestAnimationFrame !== 'function') {
    g.requestAnimationFrame = (cb: (t: number) => void) =>
      setTimeout(() => cb(Date.now()), 16);
    g.cancelAnimationFrame = (id: any) => clearTimeout(id);
  }

  // ── Prevent default scroll/zoom ──
  tt.onTouchStart(() => {}, { passive: true });
  tt.onTouchMove(() => {}, { passive: true });
}

/** Load the pixel font for Canvas text rendering. */
export function loadPixelFont(): string | null {
  try {
    const family = tt.loadFont('fonts/fusion-pixel-12px-monospaced-zh_hans.otf.woff2');
    return family || 'monospace';
  } catch {
    return 'monospace';
  }
}
