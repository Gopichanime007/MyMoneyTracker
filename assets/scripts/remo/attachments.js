/*
  reMo Attachments - IndexedDB-backed image storage, compression and thumbnail generation
  - Exposes window.reMoAttachmentsIndexed API
  Methods:
    init()
    storeImage(transactionId, File) -> {id, imageUrl, thumbUrl}
    getThumbnailUrl(id)
    getImageUrl(id)
    getBlob(id)
    remove(id)

  Offline-first, works fully in-browser. Uses canvas for compression and thumbnails.
*/
(function(){
    const DB_NAME = 'remo-attachments-db';
    const STORE = 'attachments';
    const VERSION = 1;
    let cachedDB = null;
    const urlMap = new Map(); // id -> {imageUrl, thumbUrl}
    let processingWorker = null;

    function openDB(){
        if(cachedDB) return Promise.resolve(cachedDB);
        return new Promise((res, rej)=>{
            const req = indexedDB.open(DB_NAME, VERSION);
            req.onupgradeneeded = function(e){
                const db = e.target.result;
                if(!db.objectStoreNames.contains(STORE)){
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = function(){ cachedDB = req.result; res(req.result); };
            req.onerror = ()=>rej(req.error);
        });
    }

    async function putRecord(record){
        const db = await openDB();
        return new Promise((res,rej)=>{
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            const r = store.put(record);
            r.onsuccess = ()=>res(r.result);
            r.onerror = ()=>rej(r.error);
        });
    }

    async function getRecord(id){
        const db = await openDB();
        return new Promise((res,rej)=>{
            const tx = db.transaction(STORE, 'readonly');
            const store = tx.objectStore(STORE);
            const r = store.get(id);
            r.onsuccess = ()=>res(r.result);
            r.onerror = ()=>rej(r.error);
        });
    }

    async function deleteRecord(id){
        const db = await openDB();
        return new Promise((res,rej)=>{
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            const r = store.delete(id);
            r.onsuccess = ()=>res(true);
            r.onerror = ()=>rej(r.error);
        });
    }

    function toImageBitmapOrImage(file){
        // Prefer createImageBitmap when available
        if(window.createImageBitmap){
            return createImageBitmap(file);
        }
        return new Promise((res,rej)=>{
            const img = new Image();
            img.onload = ()=>res(img);
            img.onerror = rej;
            img.src = URL.createObjectURL(file);
        });
    }

    async function compressImage(file, maxWidth=1600, quality=0.8){
        const img = await toImageBitmapOrImage(file);
        let width = img.width || img.width;
        let height = img.height || img.height;
        if(width > maxWidth){
            const ratio = maxWidth / width;
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }
        // Use OffscreenCanvas if available
        let canvas;
        if(typeof OffscreenCanvas !== 'undefined' && img instanceof ImageBitmap){
            canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
            return blob;
        }
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('toBlob failed')),'image/jpeg', quality));
    }

    async function generateThumbnail(fileOrBlob, thumbMax=200, quality=0.8){
        const imgBlob = fileOrBlob instanceof Blob ? fileOrBlob : fileOrBlob;
        const img = await toImageBitmapOrImage(imgBlob);
        let width = img.width || img.width;
        let height = img.height || img.height;
        const ratio = Math.min(thumbMax/width, thumbMax/height, 1);
        const tw = Math.round(width*ratio);
        const th = Math.round(height*ratio);
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, tw, th);
        return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('thumb toBlob failed')),'image/jpeg', quality));
    }

    function makeObjectUrl(blob){
        return URL.createObjectURL(blob);
    }

    async function storeImage(transactionId, file){
        const id = transactionId || (crypto && crypto.randomUUID ? crypto.randomUUID() : ('atta-'+Date.now()));
        // If a processing worker is available, use it to avoid main-thread work
        let compressed, thumb;
        if(window.Worker && !processingWorker){
            try{
                processingWorker = new Worker('assets/scripts/remo/attachments-worker.js');
            }catch(e){ processingWorker = null; }
        }
        if(processingWorker){
            const msgId = 'm_' + Date.now() + '_' + Math.random();
            compressed = await new Promise((res, rej)=>{
                const onmsg = (ev)=>{
                    if(ev.data && ev.data.msgId === msgId){
                        processingWorker.removeEventListener('message', onmsg);
                        if(ev.data.error) rej(new Error(ev.data.error)); else res(ev.data.compressed);
                    }
                };
                processingWorker.addEventListener('message', onmsg);
                // post file (cloneable) and parameters
                processingWorker.postMessage({ cmd: 'compress', msgId, file, maxWidth:1600, quality:0.8 });
            });
            // generate thumbnail from compressed blob (main thread) — worker could also do thumbs but keep simple
            thumb = await generateThumbnail(compressed, 200, 0.75);
        }else{
            compressed = await compressImage(file, 1600, 0.8);
            thumb = await generateThumbnail(compressed, 200, 0.75);
        }
        const record = {
            id,
            createdAt: Date.now(),
            filename: file.name || 'image.jpg',
            mime: 'image/jpeg',
            blob: compressed,
            thumb: thumb
        };
        await putRecord(record);
        // create and cache object URLs for reuse; revoke on remove or unload
        const imageUrl = makeObjectUrl(record.blob);
        const thumbUrl = makeObjectUrl(record.thumb);
        urlMap.set(id, { imageUrl, thumbUrl });
        return { id, imageUrl, thumbUrl };
    }

    async function getBlob(id){
        const r = await getRecord(id);
        return r ? r.blob : null;
    }

    // expose getRecord for metadata/GC

    async function getThumbBlob(id){
        const r = await getRecord(id);
        return r ? r.thumb : null;
    }

    async function getImageUrl(id){
        if(urlMap.has(id)) return urlMap.get(id).imageUrl;
        const b = await getBlob(id);
        if(!b) return null;
        const url = makeObjectUrl(b);
        urlMap.set(id, Object.assign(urlMap.get(id)||{}, { imageUrl: url }));
        return url;
    }

    async function getThumbnailUrl(id){
        if(urlMap.has(id) && urlMap.get(id).thumbUrl) return urlMap.get(id).thumbUrl;
        const b = await getThumbBlob(id);
        if(!b) return null;
        const url = makeObjectUrl(b);
        urlMap.set(id, Object.assign(urlMap.get(id)||{}, { thumbUrl: url }));
        return url;
    }

    async function remove(id){
        // revoke cached urls
        const urls = urlMap.get(id);
        if(urls){ if(urls.imageUrl) URL.revokeObjectURL(urls.imageUrl); if(urls.thumbUrl) URL.revokeObjectURL(urls.thumbUrl); urlMap.delete(id); }
        await deleteRecord(id);
        return true;
    }

    async function listIds(){
        const db = await openDB();
        return new Promise((res, rej)=>{
            const tx = db.transaction(STORE, 'readonly');
            const store = tx.objectStore(STORE);
            const req = store.getAllKeys();
            req.onsuccess = ()=>res(req.result);
            req.onerror = ()=>rej(req.error);
        });
    }

    // expose API
    window.reMoAttachmentsIndexed = {
        init: openDB,
        storeImage,
        getBlob,
        getImageUrl,
        getThumbBlob,
        getThumbnailUrl,
        remove,
        listIds,
        getRecord
    };

    // prefer IndexedDB-backed API globally when available
    try{
        window.reMoAttachments = window.reMoAttachmentsIndexed;
    }catch(e){}

    // revoke all object URLs on unload
    window.addEventListener('unload', ()=>{
        urlMap.forEach(u=>{ if(u.imageUrl) URL.revokeObjectURL(u.imageUrl); if(u.thumbUrl) URL.revokeObjectURL(u.thumbUrl); });
        urlMap.clear();
        if(processingWorker){ try{ processingWorker.terminate(); }catch(e){} }
    });

})();
