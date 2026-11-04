"""Bounded still-image workers. Manifest-only interface; no shell or network."""
import sys, json, os, io, math, zipfile, warnings, hashlib, struct
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter, ExifTags
Image.MAX_IMAGE_PIXELS = 40_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)
ROOT = Path(__file__).resolve().parents[2]
LIMIT = 40_000_000
MODEL_HASHES = {
    'u2netp.onnx':'309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    'FSRCNN_x2.pb':'366b33f0084c7b3f2bf6724f0a2c77bca94fcec9d7b6d72389d330073b380d5c',
    'FSRCNN_x4.pb':'5c68d18db561aed8ead4ffedf1b897ea615baaf60ebf6c35f8e641f8fa4a21bf',
}
def verify_model(model):
    if not model.is_file():raise ValueError('Local image model is missing: '+model.name)
    if hashlib.sha256(model.read_bytes()).hexdigest()!=MODEL_HASHES[model.name]:raise ValueError('Image model integrity verification failed: '+model.name)


def bounded(im):
    if not im.width or not im.height or im.width * im.height > LIMIT:
        raise ValueError('Image exceeds 40 million pixels.')
    return im

def load(item):
    source = item['source']
    if source in ('cr2','cr3','nef','arw','dng','raf','orf','rw2','pef'):
        import rawpy
        with rawpy.imread(item['path']) as raw:
            if raw.sizes.width * raw.sizes.height > LIMIT:
                raise ValueError('RAW exceeds 40 million pixels.')
            return bounded(Image.fromarray(raw.postprocess(use_camera_wb=True, output_color=rawpy.ColorSpace.sRGB, output_bps=8)))
    if source in ('heic','heif'):
        import pillow_heif
        pillow_heif.register_heif_opener()
    if source == 'jxl':
        import pillow_jxl
    im = Image.open(item['path'])
    expected={'jpg':'JPEG','jpeg':'JPEG','jfif':'JPEG','png':'PNG','webp':'WEBP','avif':'AVIF','tiff':'TIFF','bmp':'BMP','ico':'ICO','heic':'HEIF','heif':'HEIF','jxl':'JXL'}
    if source not in expected or im.format != expected[source]:
        raise ValueError('File content does not match its selected image format.')
    bounded(im)
    if getattr(im,'n_frames',1) > 1:
        raise ValueError('This tool accepts still images only.')
    im.load()
    return bounded(ImageOps.exif_transpose(im))

def rgb(im, background='#ffffff'):
    if im.mode in ('RGBA','LA') or 'transparency' in im.info:
        rgba=im.convert('RGBA'); bg=Image.new('RGBA',im.size,background);bg.alpha_composite(rgba);return bg.convert('RGB')
    return im.convert('RGB')

def encode(im,fmt,quality=90,dpi=None):
    bounded(im);im=im.copy();im.info.clear();data=io.BytesIO();opts={}
    if dpi: opts['dpi']=(dpi,dpi)
    if fmt=='jpg': im=rgb(im);opts.update(quality=quality,optimize=True)
    elif fmt=='webp':opts.update(quality=quality,method=4)
    elif fmt=='bmp':im=rgb(im)
    im.save(data,format={'jpg':'JPEG','png':'PNG','webp':'WEBP','bmp':'BMP'}[fmt],**opts)
    return data.getvalue()

def metadata(im):
    exif={}
    for key,value in im.getexif().items():
        if isinstance(value, bytes): value=f'<{len(value)} bytes>'
        elif not isinstance(value,(int,float,str,list,dict,tuple,type(None))):value=str(value)
        exif[ExifTags.TAGS.get(key,str(key))]=value
    try:
        gps=im.getexif().get_ifd(ExifTags.IFD.GPSInfo)
        if gps:exif['GPSInfo']={ExifTags.GPSTAGS.get(k,str(k)):str(v) for k,v in gps.items()}
    except (KeyError,ValueError,TypeError):pass
    return {'width':im.width,'height':im.height,'mode':im.mode,'dpi':im.info.get('dpi'),'iccProfileBytes':len(im.info.get('icc_profile',b'')),'exif':exif}

def mask_subject(im,models,threshold):
    import numpy as np
    import onnxruntime as ort
    model=Path(models)/'u2netp.onnx'
    verify_model(model)
    original=rgb(im); a=np.asarray(original.resize((320,320),Image.Resampling.LANCZOS),dtype=np.float32)
    a/=max(float(a.max()),1.0);a=(a-np.array([0.485,0.456,0.406],dtype=np.float32))/np.array([0.229,0.224,0.225],dtype=np.float32)
    a=a.transpose((2,0,1))[None,:,:,:]
    opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.inter_op_num_threads=1
    session=ort.InferenceSession(str(model),sess_options=opts,providers=['CPUExecutionProvider'])
    pred=session.run(None,{session.get_inputs()[0].name:a})[0][0,0,:,:]
    lo,hi=float(pred.min()),float(pred.max())
    if hi-lo < 1e-8:raise ValueError('Segmentation could not identify a subject; try a clearer photo.')
    pred=((pred-lo)/(hi-lo)*255).clip(0,255).astype(np.uint8)
    mask=Image.fromarray(pred).resize(im.size,Image.Resampling.LANCZOS)
    if threshold:mask=mask.point(lambda x:255 if x>=threshold else 0)
    # Retain any existing transparency.
    if im.mode=='RGBA':
        from PIL import ImageChops
        mask=ImageChops.multiply(mask,im.getchannel('A'))
    return mask

def cleanup(im,o):
    import cv2
    import numpy as np
    cv2.setNumThreads(2)
    a=cv2.cvtColor(np.asarray(rgb(im)),cv2.COLOR_RGB2BGR)
    if a.shape[0]*a.shape[1]>16_000_000:raise ValueError('Scan cleanup accepts at most 16 million pixels.')
    if o['perspective']:
        scale=min(1,1600/max(a.shape[:2]));small=cv2.resize(a,None,fx=scale,fy=scale)
        gray=cv2.cvtColor(small,cv2.COLOR_BGR2GRAY);edges=cv2.Canny(cv2.GaussianBlur(gray,(5,5),0),50,150)
        contours,_=cv2.findContours(edges,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
        for contour in sorted(contours,key=cv2.contourArea,reverse=True)[:10]:
            poly=cv2.approxPolyDP(contour,.02*cv2.arcLength(contour,True),True)
            if len(poly)==4 and cv2.contourArea(poly)>small.shape[0]*small.shape[1]*.2 and cv2.isContourConvex(poly):
                p=poly.reshape(4,2).astype(np.float32)/scale;s=p.sum(axis=1);d=np.diff(p,axis=1).ravel();q=np.array([p[np.argmin(s)],p[np.argmin(d)],p[np.argmax(s)],p[np.argmax(d)]],dtype=np.float32)
                w=int(max(np.linalg.norm(q[1]-q[0]),np.linalg.norm(q[2]-q[3])));h=int(max(np.linalg.norm(q[3]-q[0]),np.linalg.norm(q[2]-q[1])))
                if w<10 or h<10 or w*h>LIMIT:break
                transform=cv2.getPerspectiveTransform(q,np.array([[0,0],[w-1,0],[w-1,h-1],[0,h-1]],np.float32));a=cv2.warpPerspective(a,transform,(w,h),borderValue=(255,255,255));break
    gray=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY)
    if o['deskew']:
        inv=cv2.threshold(gray,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)[1];lines=cv2.HoughLinesP(inv,1,np.pi/1800,80,minLineLength=max(30,gray.shape[1]//5),maxLineGap=20)
        if lines is not None:
            angles=[math.degrees(math.atan2(l[3]-l[1],l[2]-l[0])) for l in lines.reshape(-1,4)];angles=[x for x in angles if abs(x)<=15]
            if angles:
                angle=float(np.median(angles));matrix=cv2.getRotationMatrix2D((a.shape[1]/2,a.shape[0]/2),angle,1);a=cv2.warpAffine(a,matrix,(a.shape[1],a.shape[0]),borderValue=(255,255,255));gray=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY)
    if o['mode']=='color':
        lab=cv2.cvtColor(a,cv2.COLOR_BGR2LAB);lab[:,:,0]=cv2.createCLAHE(clipLimit=2,tileGridSize=(8,8)).apply(lab[:,:,0]);return Image.fromarray(cv2.cvtColor(cv2.cvtColor(lab,cv2.COLOR_LAB2BGR),cv2.COLOR_BGR2RGB))
    bg=cv2.GaussianBlur(gray,(0,0),25);gray=cv2.divide(gray,bg,scale=255)
    if o['mode']=='binary':gray=cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY,31,12)
    return Image.fromarray(gray)

def run(m):
    op=m['operation'];o=m['options'];out=Path(m['output']);files=m['inputs'];details={};fmt=o.get('format','png')
    if op=='psd-export':
        from psd_tools import PSDImage
        with open(files[0]['path'],'rb') as stream:
            header=stream.read(26)
            if len(header)!=26 or header[:4]!=b'8BPS':raise ValueError('File is not a PSD / PSB document.')
            height,width=struct.unpack('>II',header[14:22])
            if not height or not width or height*width>LIMIT:raise ValueError('PSD exceeds 40 million pixels.')
        import psd_tools.api.utils as psd_utils
        if hasattr(psd_utils,'MAX_ALLOC_BYTES'):psd_utils.MAX_ALLOC_BYTES=256*1024*1024
        psd=PSDImage.open(files[0]['path']);bounded(psd)
        if o['mode']=='preview':
            if not psd.has_preview():raise ValueError('PSD has no cached composite preview; save with Maximize Compatibility in Photoshop.')
            im=psd.topil();data=encode(im,fmt);details={'width':im.width,'height':im.height,'cachedComposite':True}
        else:
            layers=list(psd.descendants())
            if len(layers)>100:raise ValueError('PSD layer export is limited to 100 layers.')
            stream=io.BytesIO();count=0;pixels=0
            with zipfile.ZipFile(stream,'w',zipfile.ZIP_STORED) as z:
                manifest=[]
                for index,layer in enumerate(layers):
                    if layer.is_group():continue
                    pixels+=layer.width*layer.height
                    if pixels>100_000_000:raise ValueError('PSD layers exceed 100 million total pixels.')
                    im=layer.topil()
                    if im is None:continue
                    name=f'layer-{index+1:03d}.png';z.writestr(name,encode(im,'png'));manifest.append({'file':name,'name':layer.name,'bounds':list(layer.bbox),'visible':layer.visible,'opacity':layer.opacity});count+=1
                    if stream.tell()>200_000_000:raise ValueError('PSD output exceeds 200 MB.')
                if not count:raise ValueError('PSD has no extractable raster layers.')
                z.writestr('layers.json',json.dumps(manifest))
            data=stream.getvalue();details={'layers':count}
    else:
        images=[];pixels=0
        for item in files:
            image=load(item);pixels+=image.width*image.height
            if pixels>100_000_000:raise ValueError('Images exceed 100 million total decoded pixels.')
            images.append(image)
        im=images[0]
        if op in ('heic-converter','bmp-converter','jfif-converter','jxl-converter','raw-converter'):
            data=encode(im,fmt)
        elif op=='icon-favicon':
            square=ImageOps.pad(im.convert('RGBA'),(512,512),color=(0,0,0,0));stream=io.BytesIO();square.save(stream,format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(256,256)]);data=stream.getvalue()
            if o['mode']=='png':data=encode(ImageOps.pad(im.convert('RGBA'),(o['size'],o['size']),color=(0,0,0,0)),'png')
            elif o['mode']=='pack':
                stream=io.BytesIO()
                with zipfile.ZipFile(stream,'w',zipfile.ZIP_STORED) as z:
                    z.writestr('favicon.ico',data)
                    for size in (16,32,48,64,180,192,256,512):z.writestr(f'favicon-{size}.png',encode(square.resize((size,size),Image.Resampling.LANCZOS),'png'))
                    z.writestr('site.webmanifest',json.dumps({'icons':[{'src':'favicon-192.png','sizes':'192x192','type':'image/png'},{'src':'favicon-512.png','sizes':'512x512','type':'image/png'}]}))
                data=stream.getvalue()
        elif op=='image-vectorize':
            if im.width*im.height>4_000_000:raise ValueError('Vector tracing accepts at most 4 million pixels.')
            import vtracer
            temp=out.with_suffix('.trace-input.png');temp.write_bytes(encode(im,'png'))
            try:vtracer.convert_image_to_svg_py(str(temp),str(out),colormode=o['colorMode'],color_precision=o['detail'],filter_speckle=o['speckle'])
            finally:temp.unlink(missing_ok=True)
            data=out.read_bytes()
            if b'<path' not in data or b'<image' in data:raise ValueError('Tracer did not produce vector paths.')
            details={'traced':True}
        elif op=='resize-print-image':
            divisor={'mm':25.4,'cm':2.54,'in':1}[o['unit']]
            w=max(1,math.floor(o['width']/divisor*o['dpi']+.5));h=max(1,math.floor(o['height']/divisor*o['dpi']+.5))
            if w*h>LIMIT:raise ValueError('Print resize exceeds 40 million pixels.')
            size=(w,h)
            if o['fit']=='cover':im=ImageOps.fit(im,size,Image.Resampling.LANCZOS)
            elif o['fit']=='contain':im=ImageOps.pad(rgb(im,o['background']),size,Image.Resampling.LANCZOS,color=o['background'])
            else:im=im.resize(size,Image.Resampling.LANCZOS)
            data=encode(im,fmt,dpi=o['dpi']);details={'dpi':o['dpi'],'unit':o['unit'],'printWidth':o['width'],'printHeight':o['height']}
        elif op=='passport-signature':
            target=(o['width'],o['height']);im=ImageOps.fit(im,target,Image.Resampling.LANCZOS) if o['fit']=='cover' else ImageOps.pad(im,target,Image.Resampling.LANCZOS,color='#ffffff');data=encode(im,fmt,dpi=o['dpi'])
            if o['targetKB']:
                target_bytes=o['targetKB']*1024
                if fmt=='jpg':
                    for quality in range(90,9,-5):
                        data=encode(im,fmt,quality,dpi=o['dpi'])
                        if len(data)<=target_bytes:break
                details.update(targetMet=len(data)<=target_bytes,targetBytes=target_bytes)
        elif op=='image-watermark':
            im=im.convert('RGBA');overlay=Image.new('RGBA',im.size)
            if o['mode']=='logo':
                mark=images[1].convert('RGBA');w=max(1,round(im.width*o['logoWidth']/100));h=max(1,round(mark.height*w/mark.width));
                if w*h>LIMIT:raise ValueError('Scaled logo exceeds 40 million pixels.')
                mark=mark.resize((w,h),Image.Resampling.LANCZOS)
            else:
                font_path=Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/'arial.ttf'
                font=ImageFont.truetype(str(font_path),o['fontSize']) if font_path.is_file() else ImageFont.load_default(size=o['fontSize'])
                box=font.getbbox(o['text']);w=max(1,box[2]-box[0]+4);h=max(1,box[3]-box[1]+4);mark=Image.new('RGBA',(w,h));ImageDraw.Draw(mark).text((2-box[0],2-box[1]),o['text'],font=font,fill=o['color'])
            mark.putalpha(mark.getchannel('A').point(lambda x:round(x*o['opacity']/100)));margin=max(4,round(min(im.size)*.025));pos=o['position'];x=(im.width-mark.width)//2 if pos=='center' else margin if pos.endswith('left') else im.width-mark.width-margin;y=(im.height-mark.height)//2 if pos=='center' else margin if pos.startswith('top') else im.height-mark.height-margin
            overlay.alpha_composite(mark,(x,y));im=Image.alpha_composite(im,overlay);data=encode(im,fmt)
        elif op=='image-collage':
            cols=min(o['columns'],len(images));rows=math.ceil(len(images)/cols);w=cols*o['cellWidth']+(cols+1)*o['gap'];h=rows*o['cellHeight']+(rows+1)*o['gap']
            if w*h>LIMIT:raise ValueError('Collage output exceeds 40 million pixels.')
            im=Image.new('RGB',(w,h),o['background'])
            for index,item in enumerate(images):
                tile=ImageOps.fit(rgb(item),(o['cellWidth'],o['cellHeight']),Image.Resampling.LANCZOS);im.paste(tile,(o['gap']+(index%cols)*(o['cellWidth']+o['gap']),o['gap']+(index//cols)*(o['cellHeight']+o['gap'])))
            data=encode(im,fmt)
        elif op in ('image-metadata','image-dpi'):
            if o['mode'] in ('view','check'):data=json.dumps(metadata(im),indent=2,default=str).encode()
            else:
                dpi=None
                if op=='image-dpi':
                    dpi=o['dpi']
                    if o['resample']:
                        old=im.info.get('dpi',(72,72));old=float(old[0]) if old and old[0] else 72;w=max(1,round(im.width*dpi/old));h=max(1,round(im.height*dpi/old))
                        if w*h>LIMIT:raise ValueError('DPI resampling exceeds 40 million pixels.')
                        im=im.resize((w,h),Image.Resampling.LANCZOS)
                # A new image deliberately drops source EXIF, comments, ICC and DPI.
                clean=Image.new(im.mode,im.size);clean.paste(im);data=encode(clean,fmt,dpi=dpi)
        elif op in ('remove-background','photo-background'):
            if im.width*im.height>16_000_000:raise ValueError('Background tools accept at most 16 million pixels.')
            mask=mask_subject(im,m['models'],o['threshold']);foreground=im.convert('RGBA');foreground.putalpha(mask)
            if op=='remove-background':im=foreground
            else:
                bg=im.convert('RGBA').filter(ImageFilter.GaussianBlur(o['blur'])) if o['mode']=='blur' else ImageOps.fit(images[1].convert('RGBA'),im.size,Image.Resampling.LANCZOS) if o['mode']=='image' else Image.new('RGBA',im.size,o['background'])
                bg.alpha_composite(foreground);im=bg
            data=encode(im,'png');details={'model':'u2netp','softMask':not o['threshold']}
        elif op=='ai-upscale':
            import cv2
            import numpy as np
            cv2.setNumThreads(2)
            if im.width*im.height>1_000_000:raise ValueError('AI upscale accepts at most 1 million input pixels.')
            model=Path(m['models'])/f"FSRCNN_x{o['scale']}.pb"
            verify_model(model)
            a=cv2.cvtColor(np.asarray(rgb(im)),cv2.COLOR_RGB2BGR)
            if o['denoise']:a=cv2.fastNlMeansDenoisingColored(a,None,o['denoise'],o['denoise'],7,21)
            sr=cv2.dnn_superres.DnnSuperResImpl_create();sr.readModel(str(model));sr.setModel('fsrcnn',o['scale']);a=sr.upsample(a)
            if o['enhance']:
                lab=cv2.cvtColor(a,cv2.COLOR_BGR2LAB);lab[:,:,0]=cv2.createCLAHE(clipLimit=1.5,tileGridSize=(8,8)).apply(lab[:,:,0]);a=cv2.cvtColor(lab,cv2.COLOR_LAB2BGR)
            result=Image.fromarray(cv2.cvtColor(a,cv2.COLOR_BGR2RGB))
            if im.mode=='RGBA':result=result.convert('RGBA');result.putalpha(im.getchannel('A').resize(result.size,Image.Resampling.LANCZOS))
            im=result;data=encode(im,'png');details={'model':f"FSRCNN_x{o['scale']}",'denoiser':'non-local means' if o['denoise'] else 'off'}
        elif op=='scan-cleanup':im=cleanup(im,o);data=encode(im,'png')
        else:raise ValueError('Unsupported image operation.')
        if out.suffix not in ('.svg','.json','.zip'):details.update(width=im.width,height=im.height)
    if not data or len(data)>200*1024*1024:raise ValueError('Output is empty or exceeds 200 MB.')
    out.write_bytes(data)
    if out.suffix=='.zip':
        with zipfile.ZipFile(out) as z:
            if z.testzip():raise ValueError('ZIP verification failed.')
    elif out.suffix=='.json':json.loads(data)
    elif out.suffix!='.svg':
        with Image.open(out) as verified:
            verified.load();bounded(verified);details.update(width=verified.width,height=verified.height)
    return {'details':details}

if __name__=='__main__':
    try:
        with open(sys.argv[1],encoding='utf-8-sig') as f:manifest=json.load(f)
        print(json.dumps(run(manifest)))
    except Exception as error:
        print(f'{type(error).__name__}: {error}',file=sys.stderr);sys.exit(1)
