"""Extract original PDF artwork. No logo redrawing or generated imagery."""
from pathlib import Path
from pypdf import PdfReader
import pdfplumber
import pypdfium2 as pdfium
import json

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT.parent / 'ORGTIK.pdf'
OUT = ROOT / 'public' / 'assets'
REF = ROOT / 'references'
OUT.mkdir(parents=True, exist_ok=True)
REF.mkdir(exist_ok=True)
reader = PdfReader(PDF)
manifest = []

for n, name in [(17, 'brand-cards'), (18, 'brand-phone'), (19, 'brand-glass'), (20, 'brand-tablet')]:
    original = reader.pages[n-1].images[0].image.convert('RGB')
    original.thumbnail((1920, 1200))
    original.save(OUT / f'{name}.webp', quality=90)
    manifest.append({'file':f'{name}.webp','source':f'ORGTIK.pdf page {n}, original embedded image','size':original.size,'role':'Brand application, not a SaaS product capture'})

def svg_path(curves):
    commands=[]
    for curve in curves:
        for item in curve['path']:
            op=item[0]
            if op=='h': commands.append('Z')
            else:
                commands.append(op.upper()+' '+' '.join(f'{v:.4f}' for point in item[1:] for v in point))
        commands.append('Z')
    return ' '.join(commands)

with pdfplumber.open(PDF) as doc:
    for number, color, suffix in [(14, (1,1,1), 'white'), (12, (.231,.118,.349), 'plum')]:
        p=doc.pages[number-1]
        curves=[c for c in p.curves if c['non_stroking_color']==color and 750<c['x0']<1150 and 380<c['top']<700]
        rects=[c for c in p.rects if c['non_stroking_color']==color and 750<c['x0']<1150 and 380<c['top']<700]
        for role in ['wordmark','emblem','lockup']:
            selected=[c for c in curves if role=='lockup' or (c['top']>580 if role=='wordmark' else c['top']<580)]
            selected_rects=[c for c in rects if role=='lockup' or (c['top']>580 if role=='wordmark' else c['top']<580)]
            pts=[pt for c in selected for item in c['path'] for pt in item[1:]]
            xmin=min(p[0] for p in pts)-2; xmax=max(p[0] for p in pts)+2
            ymin=min(p[1] for p in pts)-2; ymax=max(p[1] for p in pts)+2
            fill='#ffffff' if suffix=='white' else '#3B1E59'
            rect_markup=''.join(f'<rect x="{r["x0"]}" y="{r["top"]}" width="{r["width"]}" height="{r["height"]}"/>' for r in selected_rects)
            svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{xmin} {ymin} {xmax-xmin} {ymax-ymin}"><g fill="{fill}"><path fill-rule="nonzero" d="{svg_path(selected)}"/>{rect_markup}</g></svg>'
            filename=f'{role}-{suffix}.svg'
            (OUT/filename).write_text(svg,encoding='utf-8')
            manifest.append({'file':filename,'source':f'ORGTIK.pdf page {number}; exact original vector path coordinates','role':'Supplied brand artwork, mechanically converted to SVG'})

doc=pdfium.PdfDocument(str(PDF))
for n in [8,14,17,18,19,20]:
    doc[n-1].render(scale=.65).to_pil().save(REF/f'brand-page-{n}.png')
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Extracted',len(manifest),'brand assets and six source reference pages.')
