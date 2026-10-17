// Browser-only, dependency-free clock. Serialized into isolated canvases.
export function createTimelineAPI(animate, capture = false, notify = () => {}) {
  const timelines = new Map();
  function timeline(options) {
    const {id = 'main', duration, draw, loop = false, autoplay = true, chapters = []} = options ?? {};
    if (typeof id !== 'string' || !/^[A-Za-z_][\w-]{0,63}$/.test(id) || timelines.has(id)) throw Error('Timeline id must be unique');
    if (!Number.isFinite(duration) || duration <= 0 || duration > 86400 || typeof draw !== 'function') throw Error('Timeline requires positive duration and draw(time, info)');
    if (!Array.isArray(chapters) || chapters.length > 100 || chapters.some(c => !c || typeof c.label !== 'string' || !Number.isFinite(c.time) || c.time < 0 || c.time >= duration)) throw Error('Invalid timeline chapters');
    let time = 0, playing = !!autoplay && !capture, disposed = false, reduced = false, visible = true;
    const listeners = new Set();
    const state = () => ({id, time, duration, playing, loop: !!loop, reducedMotion: reduced, visible, chapters: chapters.map(c => ({time:c.time,label:c.label}))});
    const render = () => { draw(time, state()); notify(state()); for (const fn of listeners) fn(state()); };
    const seek = value => { if (disposed) throw Error('Timeline disposed'); if (!Number.isFinite(value)) throw Error('Timeline seek requires finite seconds'); time = Math.max(0, Math.min(duration, value)); render(); return state(); };
    const api = Object.freeze({state,seek,play(){if(disposed)throw Error('Timeline disposed');playing=true;render()},pause(){playing=false;render()},replay(){playing=!capture;seek(0)},chapter(index){if(!Number.isInteger(index)||!chapters[index])throw Error('Invalid chapter');playing=false;return seek(chapters[index].time)},subscribe(fn){if(typeof fn!=='function')throw Error('Timeline listener required');listeners.add(fn);fn(state());return()=>listeners.delete(fn)},dispose(){if(disposed)return;disposed=true;stop();listeners.clear();timelines.delete(id)}});
    // Register before animate(), which synchronously supplies the initial frame.
    timelines.set(id, api);
    const stop = animate(info => {
      reduced = !!info.reducedMotion; visible = info.visible !== false;
      if (!capture && playing && !reduced && visible) {
        const next = time + info.delta;
        time = loop ? next % duration : Math.min(duration, next);
        if (!loop && time === duration) playing = false;
      }
      render();
    });
    return api;
  }
  return {timeline, capture: Object.freeze({list:()=>[...timelines.values()].map(t=>t.state()),seek:(id,time)=>{const t=timelines.get(id);if(!t)throw Error('Timeline not found: '+id);t.seek(time);t.pause();return t.state()}})};
}
