"""Bounded Pillow animation tools and offline faster-whisper transcription."""
import sys, json, os, math
from pathlib import Path
from PIL import Image, ImageOps, ImageSequence
Image.MAX_IMAGE_PIXELS = 16000000

def animation(m):
    o=m['options']; op=m['operation']; frames=[]; delays=[]; loop=max(0,int(o.get('loop',-1)))
    for p in m['inputs']:
        with Image.open(p) as im:
            if im.format not in ('PNG','JPEG','GIF','WEBP'): raise ValueError('Input is not a supported animation or image format.')
            count=getattr(im,'n_frames',1)
            if im.width*im.height>16000000: raise ValueError('Animation frame exceeds 16 million pixels.')
            if count>240: raise ValueError('Animation is limited to 240 frames.')
            if im.width*im.height*count>64000000: raise ValueError('Decoded animation exceeds 64 million pixels.')
            if op!='gif-maker':
                raw_loop=im.info.get('loop')
                source_loop=(1 if raw_loop is None else 0 if raw_loop==0 else int(raw_loop)+(1 if im.format=='GIF' else 0))
                loop=int(o['loop']) if int(o.get('loop',-1))>=0 else source_loop
            for frame in ImageSequence.Iterator(im):
                frame=ImageOps.exif_transpose(frame).convert('RGBA')
                if op=='gif-maker':
                    canvas=Image.new('RGBA',(int(o.get('width',480)),int(o.get('height',480))),(0,0,0,0))
                    frame.thumbnail(canvas.size,Image.Resampling.LANCZOS)
                    canvas.alpha_composite(frame,((canvas.width-frame.width)//2,(canvas.height-frame.height)//2)); frame=canvas
                    delay=int(o.get('delay',100))
                else: delay=max(10,int(frame.info.get('duration',im.info.get('duration',100))))
                if o.get('cropWidth',0)>0 and o.get('cropHeight',0)>0:
                    x=int(o.get('left',0)); y=int(o.get('top',0)); w=int(o['cropWidth']); h=int(o['cropHeight'])
                    if x+w>frame.width or y+h>frame.height: raise ValueError('Crop extends outside animation.')
                    frame=frame.crop((x,y,x+w,y+h))
                width=int(o.get('width',480))
                if frame.width>width: frame=frame.resize((width,max(1,round(frame.height*width/frame.width))),Image.Resampling.LANCZOS)
                frames.append(frame.copy()); delays.append(max(10,round(delay/float(o.get('speed',1)))))
                if len(frames)>240 or sum(f.width*f.height for f in frames)>64000000: raise ValueError('Decoded animation exceeds frame/memory budget.')
    if not frames: raise ValueError('No decoded animation frames.')
    start=float(o.get('start',0))*1000; end=start+float(o.get('duration',20))*1000; clock=0; selected=[]; durations=[]
    for frame,delay in zip(frames,delays):
        if clock+delay>start and clock<end: selected.append(frame); durations.append(max(10,round(min(clock+delay,end)-max(clock,start))))
        clock+=delay
    frames=selected; delays=durations
    if not frames: raise ValueError('Trim range contains no frames.')
    if o.get('reverse',False): frames.reverse(); delays.reverse()
    if sum(delays)>30000: raise ValueError('Animation duration is limited to 30 seconds.')
    fmt=o.get('format','gif'); target=int(o.get('targetKB',0))*1024
    best=None
    for attempt in range(6 if target else 1):
        scaled=[f.resize((max(1,round(f.width*(0.8**attempt))),max(1,round(f.height*(0.8**attempt)))),Image.Resampling.LANCZOS) for f in frames]
        for frame in scaled: frame.info.pop('loop',None)
        opts=dict(save_all=True,append_images=scaled[1:],duration=delays)
        if fmt!='gif' or loop!=1: opts['loop']=loop-1 if fmt=='gif' and loop>0 else loop
        if fmt=='gif':
            if target: scaled=[f.quantize(colors=min(int(o.get('colors',128)),max(16,256//(2**(attempt//2)))),method=Image.Quantize.FASTOCTREE) for f in scaled]
            opts.update(optimize=True,disposal=2)
        if fmt=='webp': opts.update(quality=int(o.get('quality',80)),method=4)
        if fmt=='apng': opts.update(disposal=0,blend=0)
        scaled[0].save(m['output'],format={'apng':'PNG','gif':'GIF','webp':'WEBP'}[fmt],**opts)
        size=os.path.getsize(m['output'])
        if best is None or size<best[0]: best=(size,Path(m['output']).read_bytes())
        if not target or size<=target: break
    Path(m['output']).write_bytes(best[1])
    with Image.open(m['output']) as check:
        actual=getattr(check,'n_frames',1)
        if actual<1: raise ValueError('Encoded animation is empty.')
        for frame in ImageSequence.Iterator(check): frame.load()
    return {'frames':actual,'duration':sum(delays)/1000,'bytes':best[0],'targetMet':not target or best[0]<=target,'message':('Target cannot be met within six bounded attempts.' if target and best[0]>target else 'Animation encoded and decoded successfully.')}

def transcribe(m):
    from faster_whisper import WhisperModel
    model=Path(m['model'])
    if not (model/'model.bin').is_file(): raise ValueError('Local Whisper tiny model is missing. Install .tools/models/media/whisper-tiny first.')
    language=m['options'].get('language','auto')
    if language!='auto' and (len(language)>5 or not language.replace('-','').isalpha()): raise ValueError('Invalid language code.')
    engine=WhisperModel(str(model),device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
    segments,info=engine.transcribe(m['inputs'][0],language=None if language=='auto' else language,beam_size=1,vad_filter=True)
    segments=list(segments)
    fmt=m['options'].get('format','txt')
    def timestamp(value):
        ms=round(value*1000); h,ms=divmod(ms,3600000); minute,ms=divmod(ms,60000); sec,ms=divmod(ms,1000)
        return f'{h:02}:{minute:02}:{sec:02}{"," if fmt=="srt" else "."}{ms:03}'
    if fmt=='txt': text='\n'.join(s.text.strip() for s in segments)+'\n'
    else: text=('WEBVTT\n\n' if fmt=='vtt' else '')+'\n\n'.join(f'{i+1}\n{timestamp(s.start)} --> {timestamp(s.end)}\n{s.text.strip()}' for i,s in enumerate(segments))+'\n'
    Path(m['output']).write_text(text,encoding='utf-8')
    return {'segments':len(segments),'language':info.language,'message':'No speech detected.' if not segments else 'Local speech recognition completed.'}

try:
    m=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    print(json.dumps(transcribe(m) if m['operation']=='transcribe-media' else animation(m)))
except Exception as e:
    print(str(e),file=sys.stderr); sys.exit(1)
