self.addEventListener('message', async (e)=>{
    const data = e.data || {};
    if(data.cmd === 'compress'){
        const { msgId, file, maxWidth=1600, quality=0.8 } = data;
        try{
            const img = await createImageBitmap(file);
            let width = img.width;
            let height = img.height;
            if(width > maxWidth){
                const ratio = maxWidth / width;
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            let canvas;
            if(typeof OffscreenCanvas !== 'undefined'){
                canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
                self.postMessage({ msgId, compressed: blob });
            } else {
                // fallback: create a bitmap canvas via HTMLCanvasElement (not available in worker)
                // If OffscreenCanvas not available, try to downscale using ImageBitmap's close as last resort
                const blob = await file.arrayBuffer().then(buf=>new Blob([buf], {type:'image/jpeg'}));
                self.postMessage({ msgId, compressed: blob });
            }
        }catch(err){
            self.postMessage({ msgId, error: String(err) });
        }
    }
});