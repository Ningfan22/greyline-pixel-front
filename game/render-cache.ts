type Bitmap = CanvasImageSource & { width: number; height: number };
const filtered = new WeakMap<object, Map<string, HTMLCanvasElement>>();
const mutableFiltered = new WeakMap<object, {
  version:number;filter:string;output:HTMLCanvasElement;
}>();
/** Pixel-identical filtered sprites are baked once, not composited once per wreck per frame. */
export function filteredSprite(source: Bitmap, filter: string, version?: number) {
  // Actor rasters are mutable. Keep one filtered surface per actor, and
  // repaint when either its pixels or its current decay filter changes.
  if (version !== undefined) {
    let entry=mutableFiltered.get(source);
    if(!entry){
      const output=document.createElement('canvas');
      output.width=source.width;output.height=source.height;
      entry={version:-1,filter:'',output};mutableFiltered.set(source,entry);
    }
    if(entry.version!==version||entry.filter!==filter||
       entry.output.width!==source.width||entry.output.height!==source.height){
      const output=entry.output;
      if(output.width!==source.width)output.width=source.width;
      if(output.height!==source.height)output.height=source.height;
      const ctx=output.getContext('2d')!;
      ctx.clearRect(0,0,output.width,output.height);
      ctx.imageSmoothingEnabled=false;ctx.filter=filter;
      ctx.drawImage(source,0,0);
      entry.version=version;entry.filter=filter;
    }
    return entry.output;
  }
  let variants = filtered.get(source);
  if (!variants) {
    variants = new Map();
    filtered.set(source, variants);
  }
  let output = variants.get(filter);
  if (output) return output;
  output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const ctx = output.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.filter = filter;
  ctx.drawImage(source, 0, 0);
  variants.set(filter, output);
  return output;
}
