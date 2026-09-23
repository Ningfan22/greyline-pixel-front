// Imported before the UI/render modules: some render caches create canvases
// during module evaluation, before main.boot() can run.
import { initAdapter } from './adapter';

initAdapter();
