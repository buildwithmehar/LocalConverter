"""Bounded local document operations. Only the job manifest is an argument."""
import sys,json,pathlib,io,zipfile,csv,re,subprocess,os,hashlib,difflib,urllib.parse,xml.etree.ElementTree as ET
import pymupdf as fitz
from PIL import Image,ImageChops,ImageStat

M=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
OUT=pathlib.Path(M['outputDir']).resolve(); O=M.get('options',{}); OP=M['operation']; INPUTS=M['inputs']
OUT.mkdir(parents=True,exist_ok=True)
def fail(s): raise ValueError(s)
def result(p,mime,details=None):
 p=pathlib.Path(p)
 if not p.is_file() or not p.stat().st_size or p.stat().st_size>200*1024*1024: fail('Output is empty or exceeds 200 MB.')
 return {'path':str(p),'filename':p.name,'mime':mime,'details':details or {}}
def pdf(i=0,password=None):
 p=pathlib.Path(INPUTS[i]['path'])
 if p.read_bytes()[:5]!=b'%PDF-': fail('File contents do not match PDF.')
 d=fitz.open(p)
 if d.needs_pass and not d.authenticate(password or ''): fail('PDF needs the correct open password.')
 if not 1<=len(d)<=100: fail('Choose a PDF with 1 to 100 pages.')
 return d
def pages(d):
 s=str(O.get('pages','')).strip()
 if not s:return list(range(len(d)))
 out=[]
 for token in s.split(','):
  m=re.fullmatch(r'\s*(\d+)(?:\s*-\s*(\d+))?\s*',token)
  if not m:fail('Use page numbers or ascending ranges, such as 1,3-5.')
  a,b=int(m[1]),int(m[2] or m[1])
  if a<1 or b<a or b>len(d):fail('Page selection is outside the PDF.')
  out.extend(range(a-1,b))
 if len(out)!=len(set(out)):fail('Page selection cannot repeat pages.')
 return out
def save(d,name='result.pdf',details=None):
 p=OUT/name;d.save(p,garbage=4,deflate=True);d.close()
 with fitz.open(p) as check:
  if not len(check):fail('PDF output verification failed.')
 return result(p,'application/pdf',details)
def render(d,ext='png',dpi=120):
 if len(d)>20:fail('Rendering is limited to 20 pages.')
 paths=[]
 for n,page in enumerate(d):
  if page.rect.width*page.rect.height*(dpi/72)**2>40_000_000:fail('Rendered page exceeds 40 million pixels.')
  p=OUT/f'page-{n+1:03}.{ext}'; pix=page.get_pixmap(dpi=dpi,alpha=False);pix.save(p);paths.append(p)
 return paths
def zipfiles(paths,name='result.zip'):
 p=OUT/name
 with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
  for q in paths:z.write(q,q.name)
 return result(p,'application/zip')
def external(name):
 p=M.get('native',{}).get(name)
 if not p or not pathlib.Path(p).is_file():fail(f'{name} is not configured. Install the official local engine in .tools/native.')
 return p
def bounded(command,timeout=120):
 try:r=subprocess.run(command,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout,creationflags=0x08000000 if os.name=='nt' else 0)
 except subprocess.TimeoutExpired:fail('Native document engine timed out.')
 if r.returncode:fail('Native document engine could not convert this file.')
def external_ref(value):
 value=urllib.parse.unquote(str(value)).strip().replace('\\','/')
 return bool(re.match(r'^[a-z][a-z0-9+.-]*:',value,re.I) or value.startswith('/') or '..' in pathlib.PurePosixPath(value).parts)
def validate_rtf(p):
 data=pathlib.Path(p).read_bytes()
 if not data.lstrip().startswith(b'{\\rtf'):fail('File contents do not match RTF.')
 if re.search(rb'\\(?:field|fldinst|object|objdata|objautlink|objupdate|filetbl|template|linkval|htmltag)\b',data,re.I):fail('RTF external fields, templates and embedded objects are disabled. Export a self-contained RTF without fields or objects.')
def xml_text(data):
 try:
  if data.startswith((b'\xff\xfe',b'\xfe\xff')):return data.decode('utf-16')
  if data.startswith(b'<\x00'):return data.decode('utf-16-le')
  if data.startswith(b'\x00<'):return data.decode('utf-16-be')
  return data.decode('utf-8-sig')
 except UnicodeError:fail('Document XML and HTML resources must use UTF-8 or UTF-16.')
def validate_archive(p,kind=None):
 with zipfile.ZipFile(p) as z:
  if len(z.infolist())>2000 or sum(i.file_size for i in z.infolist())>200*1024*1024:fail('Document archive exceeds expanded limits.')
  required={'docx':'word/document.xml','xlsx':'xl/workbook.xml','pptx':'ppt/presentation.xml','odt':'content.xml','ods':'content.xml','odp':'content.xml'}
  if kind in required and required[kind] not in z.namelist():fail('Document package contents do not match the selected Office format.')
  odf_types={'odt':'application/vnd.oasis.opendocument.text','ods':'application/vnd.oasis.opendocument.spreadsheet','odp':'application/vnd.oasis.opendocument.presentation'}
  if kind in odf_types and ('mimetype' not in z.namelist() or z.read('mimetype').decode('ascii','replace')!=odf_types[kind]):fail('OpenDocument mimetype does not match the selected format.')
  for i in z.infolist():
   normalized=i.filename.replace('\\','/')
   if '..' in pathlib.PurePosixPath(normalized).parts or normalized.startswith('/') or re.match(r'^[a-z]:',normalized,re.I) or (i.external_attr>>16)&0o170000==0o120000:fail('Unsafe document archive path.')
   if re.search(r'(?:^|/)(?:Basic|Scripts)(?:/|$)|vbaproject|macros',i.filename,re.I):fail('Document macros and scripts are disabled.')
   if i.filename.lower().endswith(('.rels','.xml')):
    if i.file_size>10*1024*1024:fail('Document XML part exceeds 10 MB.')
    data=z.read(i)
    if re.search(r'<!ENTITY|<!DOCTYPE',xml_text(data),re.I):fail('Document XML entities and doctypes are disabled.')
    try:tree=ET.fromstring(data)
    except ET.ParseError:fail('Document contains malformed XML.')
    for node in tree.iter():
     local=node.tag.rsplit('}',1)[-1].lower()
     if local in ('script','event-listener','event-listeners') or (local=='scripts' and len(node)):fail('Document macros and scripts are disabled.')
     for key,value in node.attrib.items():
      attr=key.rsplit('}',1)[-1].lower()
      if attr=='targetmode' and value.lower()=='external':fail('External resources in documents are disabled. Remove external relationships first.')
      if attr in ('href','src') and external_ref(value):fail('External document resources are disabled. Embed linked graphics and remove external links first.')
      if attr=='target':
       target=urllib.parse.unquote(value).strip().replace('\\','/')
       if re.match(r'^[a-z][a-z0-9+.-]*:',target,re.I) or target.startswith('//'):fail('External relationship targets are disabled.')
      if attr=='formula' and re.search(r'WEBSERVICE|DDE|RTD\s*\(|(?:https?|file|ftp):|\.\.[/\\]|[/\\]{2}',value,re.I):fail('External spreadsheet formulas are disabled.')
     if local in ('f','formula') and re.search(r'WEBSERVICE|DDE|RTD\s*\(|(?:https?|file|ftp)://',node.text or '',re.I):fail('External spreadsheet formulas are disabled.')
def main():
 if OP in ('reorder-pdf','rotate-pdf','stamp-pdf','fill-pdf-form','compress-pdf','extract-pdf-images','pdf-tables','pdf-markdown','ocr-render','ocr-finish','compare-pdfs'):
  if OP=='ocr-finish':
   d=fitz.open()
   for p in M['ocrPages']:
    with fitz.open(p) as src:d.insert_pdf(src)
   return save(d,'searchable.pdf')
  if OP=='ocr-render' and INPUTS[0].get('source')!='pdf':
   with Image.open(INPUTS[0]['path']) as im:
    if im.width*im.height>40_000_000:fail('OCR image exceeds 40 million pixels.')
    if getattr(im,'n_frames',1)>1:fail('Use one still image or a PDF for OCR.')
    p=OUT/'ocr-image.png';im.convert('RGB').save(p)
   return {'pages':[str(p)]}
  d=pdf()
  if OP=='ocr-render':return {'pages':[str(p) for p in render(d,'png',150)]}
  if OP=='reorder-pdf':d.select(pages(d));return save(d)
  if OP=='rotate-pdf':
   for n in pages(d):d[n].set_rotation((d[n].rotation+int(O['angle']))%360)
   return save(d)
  if OP=='compress-pdf':
   original=pathlib.Path(INPUTS[0]['path']).stat().st_size
   if O['mode']=='raster':
    if len(d)>20:fail('Raster compression is limited to 20 pages.')
    out=fitz.open()
    for page in d:
     dpi=int(O['dpi'])
     if page.rect.width*page.rect.height*(dpi/72)**2>40_000_000:fail('Raster page exceeds pixel limit.')
     pix=page.get_pixmap(dpi=dpi,alpha=False);img=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);b=io.BytesIO();img.save(b,'JPEG',quality=int(O['quality']),optimize=True)
     p=out.new_page(width=page.rect.width,height=page.rect.height);p.insert_image(p.rect,stream=b.getvalue())
    d=out
   r=save(d,'compressed.pdf');r['details']={'originalBytes':original,'outputBytes':pathlib.Path(r['path']).stat().st_size,'lossy':O['mode']=='raster'};return r
  if OP=='stamp-pdf':
   ids=pages(d);kind=O['kind'];overlay=pdf(1) if kind=='overlay' else None
   if overlay and len(overlay) not in (1,len(d)):fail('Overlay must have one page or the same page count as the destination.')
   for n in ids:
    p=d[n]
    if overlay:p.show_pdf_page(p.rect,overlay,0 if len(overlay)==1 else n,overlay=True)
    else:
     s=str(n+1) if kind=='numbers' else O['text'];size=int(O['fontSize']);alpha=O['opacity']/100
     if not s.strip():fail('Stamp text must not be empty.')
     if any(ord(c)>255 or ord(c)<32 for c in s):fail('PDF stamps support single-line Latin-1 text with the bundled Helvetica font.')
     width=fitz.get_text_length(s,fontsize=size)
     if width>p.rect.width-24:fail('Stamp text is wider than the page; reduce font size or text length.')
     y=p.rect.height/2 if kind=='watermark' else p.rect.height-24
     p.insert_text((max(12,(p.rect.width-width)/2),y),s,fontsize=size,color=(0.3,0.3,0.3),fill_opacity=alpha)
   return save(d)
  if OP=='fill-pdf-form':
   if d.xref_get_key(d.pdf_catalog(),'AcroForm/XFA')[0]!='null':fail('Dynamic XFA forms are unsupported.')
   vals=json.loads(O['values'])
   if not isinstance(vals,dict) or len(vals)>100:fail('Field values must be a JSON object with at most 100 fields.')
   form_pages=list(d)
   widgets=[w for p in form_pages for w in (p.widgets() or [])];names={w.field_name for w in widgets}
   if not widgets:fail('This PDF has no standard AcroForm fields.')
   if set(vals)-names:fail('Unknown fields. Available: '+', '.join(sorted(names))[:500])
   for w in widgets:
    if w.field_name in vals:
     v=vals[w.field_name]
     if w.field_type not in (fitz.PDF_WIDGET_TYPE_TEXT,fitz.PDF_WIDGET_TYPE_CHECKBOX,fitz.PDF_WIDGET_TYPE_COMBOBOX,fitz.PDF_WIDGET_TYPE_LISTBOX):fail('Only text, checkbox and single-choice AcroForm fields can be filled.')
     if w.field_type==fitz.PDF_WIDGET_TYPE_CHECKBOX:
      if not isinstance(v,bool):fail('Checkbox values must be JSON true or false.')
      v=w.on_state() if v else 'Off'
     elif not isinstance(v,(str,int,float)):fail('Text and choice fields need string values.')
     elif w.field_type in (fitz.PDF_WIDGET_TYPE_COMBOBOX,fitz.PDF_WIDGET_TYPE_LISTBOX) and str(v) not in (w.choice_values or []):fail('Choice field value must match an available choice.')
     w.field_value=v;w.update()
     # Some writers put /V on a separate parent field. Keep that terminal
     # field synchronized with the widget appearance for other PDF readers.
     parent=d.xref_get_key(w.xref,'Parent')
     if parent[0]=='xref' and d.xref_get_key(w.xref,'T')[0]=='null':
      value_type,value=d.xref_get_key(w.xref,'V')
      if value_type in ('string','name','int','float'):
       d.xref_set_key(int(parent[1].split()[0]),'V',fitz.get_pdf_str(value) if value_type=='string' else value)
   if O['flatten']:d.bake(annots=False,widgets=True)
   return save(d)
  if OP=='extract-pdf-images':
   files=[];index=[];seen=set()
   for n,p in enumerate(d):
    for image in p.get_images(full=True):
     xref=image[0]
     if xref in seen:continue
     seen.add(xref);data=d.extract_image(xref)
     if data:
      q=OUT/f'image-{xref}.{data["ext"]}';q.write_bytes(data['image']);files.append(q);index.append({'file':q.name,'firstPage':n+1,'width':data['width'],'height':data['height'],'maskXref':data.get('smask',0)})
      if data.get('smask'):
       mask=d.extract_image(data['smask']);q=OUT/f'image-{xref}-mask.{mask["ext"]}';q.write_bytes(mask['image']);files.append(q)
   if not files:fail('No embedded raster image objects were found.')
   q=OUT/'index.json';q.write_text(json.dumps(index,indent=2),encoding='utf-8');return zipfiles(files+[q],'embedded-images.zip')
  if OP=='pdf-markdown':
   import pymupdf4llm
   if not any(p.get_text().strip() for p in d):fail('PDF has no selectable text. Run OCR first.')
   s=pymupdf4llm.to_markdown(d,write_images=False,embed_images=False,show_progress=False)
   p=OUT/'document.md';p.write_text(s,encoding='utf-8');return result(p,'text/markdown')
  if OP=='pdf-tables':
   tables=[]
   for n,p in enumerate(d):
    for k,t in enumerate(p.find_tables(strategy=O['strategy']).tables):tables.append((f'page{n+1}-table{k+1}',t.extract()))
   if not tables:fail('No tables detected. Try text detection, or OCR scanned pages first.')
   if sum(len(rows)*max((len(r) for r in rows),default=0) for _,rows in tables)>100000:fail('Tables exceed 100,000 cells.')
   if O['format']=='xlsx':
    from openpyxl import Workbook,load_workbook
    wb=Workbook();wb.remove(wb.active)
    for name,rows in tables:
     ws=wb.create_sheet(name)
     for row in rows:ws.append([str(v or '') for v in row])
     for row in ws:
      for cell in row:cell.data_type='s'
    p=OUT/'tables.xlsx';wb.save(p);load_workbook(p,read_only=True).close();return result(p,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
   files=[]
   for name,rows in tables:
    p=OUT/f'{name}.csv'
    with p.open('w',newline='',encoding='utf-8-sig') as f:csv.writer(f).writerows(rows)
    files.append(p)
   return zipfiles(files,'tables.zip')
  if OP=='compare-pdfs':
   other=pdf(1)
   if max(len(d),len(other))>20:fail('Comparison is limited to 20 pages per PDF.')
   files=[];records=[];dpi=int(O['dpi'])
   for n in range(max(len(d),len(other))):
    texts=[doc[n].get_text() if n<len(doc) else '' for doc in (d,other)]
    record={'page':n+1,'textEqual':texts[0]==texts[1],'textDiff':list(difflib.unified_diff(texts[0].splitlines(),texts[1].splitlines(),fromfile='before',tofile='after',lineterm=''))}
    images=[]
    for doc in (d,other):
     if n<len(doc):
      p=doc[n]
      if p.rect.width*p.rect.height*(dpi/72)**2>40_000_000:fail('Comparison page exceeds pixel limit.')
      pix=p.get_pixmap(dpi=dpi,alpha=False);images.append(Image.frombytes('RGB',(pix.width,pix.height),pix.samples))
     else:images.append(Image.new('RGB',(1,1),'white'))
    size=(max(i.width for i in images),max(i.height for i in images));canvases=[]
    for im in images:c=Image.new('RGB',size,'white');c.paste(im,(0,0));canvases.append(c)
    diff=ImageChops.difference(*canvases);gray=diff.point(lambda v:255 if v else 0).convert('L');hist=gray.histogram();changed=sum(hist[1:]);record['changedPixelFraction']=changed/(size[0]*size[1]);record['visualEqual']=changed==0
    if changed:q=OUT/f'difference-{n+1:03}.png';diff.save(q);files.append(q)
    records.append(record)
   q=OUT/'comparison.json';q.write_text(json.dumps({'pageCounts':[len(d),len(other)],'pages':records},indent=2),encoding='utf-8');return zipfiles([q]+files,'comparison.zip')
 if OP in ('protect-pdf','unlock-pdf'):
  import pikepdf,secrets
  pw=O['password']
  if not pw or len(pw)>256:fail('Supply a password of 1 to 256 characters.')
  p=OUT/'result.pdf'
  try:
   with pikepdf.open(INPUTS[0]['path'],password=pw if OP=='unlock-pdf' else '') as d:
    if not 1<=len(d.pages)<=100:fail('Choose a PDF with 1 to 100 pages.')
    d.save(p,encryption=pikepdf.Encryption(owner=secrets.token_urlsafe(32),user=pw,R=6) if OP=='protect-pdf' else False)
   with pikepdf.open(p,password=pw if OP=='protect-pdf' else '') as check:pass
  except pikepdf.PasswordError:fail('The supplied PDF password is incorrect.')
  return result(p,'application/pdf')
 if OP=='office-render':
  source=pathlib.Path(INPUTS[0]['path']);ext=INPUTS[0]['source']
  if ext in ('docx','xlsx','pptx','odt','ods','odp'):validate_archive(source,ext)
  else:validate_rtf(source)
  import uuid
  office=external('LibreOffice');profile=(OUT/('office-profile-'+uuid.uuid4().hex)).as_uri()
  bounded([office,'-env:UserInstallation='+profile,'--headless','--norestore','--nodefault','--nolockcheck','--convert-to','pdf','--outdir',str(OUT),str(source)])
  p=OUT/(source.stem+'.pdf')
  if not p.exists():fail('LibreOffice did not produce a PDF.')
  with fitz.open(p) as d:
   if not 1<=len(d)<=100:fail('Office output exceeds 100 pages.')
   if O['format']!='pdf':return zipfiles(render(d,O['format'],int(O['dpi'])),'office-pages.zip')
  return result(p,'application/pdf')
 if OP=='convert-font':
  from fontTools.ttLib import TTFont
  header=pathlib.Path(INPUTS[0]['path']).read_bytes()[:48]
  if header[:4] in (b'wOFF',b'wOF2') and len(header)>=20 and int.from_bytes(header[16:20],'big')>200*1024*1024:fail('Expanded font exceeds 200 MB.')
  font=TTFont(INPUTS[0]['path'],lazy=False);fmt=O['format'];font.flavor=fmt if fmt!='sfnt' else None
  ext=fmt if fmt!='sfnt' else 'otf' if font.sfntVersion=='OTTO' else 'ttf';p=OUT/('font.'+ext);font.save(p);font.close();check=TTFont(p);check.close()
  return result(p,{'woff':'font/woff','woff2':'font/woff2','ttf':'font/ttf','otf':'font/otf'}[ext])
 if OP=='semantic-document':
  import pypandoc
  src=pathlib.Path(INPUTS[0]['path']);ext=INPUTS[0]['source'];fmt=O['format'];formats={'md':'markdown','markdown':'markdown','htm':'html'}
  if ext in ('docx','odt'):validate_archive(src,ext)
  elif ext=='rtf':validate_rtf(src)
  else:
   s=src.read_text(encoding='utf-8-sig')
   if re.search(r'!\[|<\s*(?:img|script|iframe|object|link|embed)\b|@import|url\s*\(|<!ENTITY',s,re.I):fail('Semantic conversion requires self-contained text without embedded/external resources. Use local HTML rendering for page assets.')
  p=OUT/('document.'+fmt)
  pypandoc.convert_file(str(src),formats.get(fmt,fmt),format=formats.get(ext,ext),outputfile=str(p),extra_args=['--standalone','--sandbox'])
  if fmt in ('docx','odt','epub'):validate_archive(p)
  return result(p,{'md':'text/markdown','html':'text/html','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','odt':'application/vnd.oasis.opendocument.text','rtf':'application/rtf','epub':'application/epub+zip'}[fmt])
 if OP=='convert-ebook':
  src=pathlib.Path(INPUTS[0]['path']);ext=INPUTS[0]['source'];fmt=O['format'];data=src.read_bytes()
  if ext=='epub':
   validate_archive(src)
   with zipfile.ZipFile(src) as z:
    if z.read('mimetype')!=b'application/epub+zip':fail('Invalid EPUB content.')
    if 'META-INF/encryption.xml' in z.namelist():fail('Encrypted/DRM ebooks are unsupported.')
    for entry in z.infolist():
     if entry.filename.lower().endswith(('.css','.html','.htm','.xhtml','.svg')):
      content=xml_text(z.read(entry))
      if re.search(r'<!ENTITY|<!DOCTYPE[^>]+(?:SYSTEM|PUBLIC)',content,re.I):fail('External ebook entities and doctypes are disabled.')
      if re.search(r'src\s*=\s*["\']\s*(?:https?:|file:|ftp:|//)|<(?:link|image|object)\b[^>]*(?:href|data)\s*=\s*["\']\s*(?:https?:|file:|ftp:|//)|url\s*\(\s*["\']?\s*(?:https?:|file:|ftp:|//)|@import\s*["\']\s*(?:https?:|file:|ftp:|//)',content,re.I):fail('Ebook resources must be bundled locally; external resource links are disabled.')
  elif len(data)<80 or data[60:68] not in (b'BOOKMOBI',b'TEXtREAd'):fail('File contents do not match MOBI/AZW3.')
  # Uploaded files may carry opaque job names, so supply an explicit source suffix.
  local=OUT/('ebook-input.'+ext);local.write_bytes(data);p=OUT/('ebook.'+fmt)
  bounded([external('Calibre'),str(local),str(p),'--disable-font-rescaling'],150)
  if fmt=='epub':validate_archive(p)
  elif fmt=='pdf':
   with fitz.open(p) as check:
    if not 1<=len(check)<=100:fail('Ebook PDF exceeds 100 pages.')
  elif fmt in ('mobi','azw3') and p.read_bytes()[60:68]!=b'BOOKMOBI':fail('Ebook output validation failed.')
  return result(p,{'epub':'application/epub+zip','mobi':'application/x-mobipocket-ebook','azw3':'application/vnd.amazon.ebook','pdf':'application/pdf','txt':'text/plain'}[fmt])
 fail('Unsupported document operation.')
try:print(json.dumps(main(),ensure_ascii=True))
except Exception as e:
 # Never include manifests, passwords or subprocess arguments in errors.
 print(str(e)[:800],file=sys.stderr);sys.exit(1)
