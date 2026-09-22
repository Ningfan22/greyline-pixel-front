"""Build traceable software-registration PDFs from the current mini-game sources.

Run with Python containing reportlab and pypdf. Outputs stay under output/pdf/.
No third-party dependency code, credentials, identity data or fake screenshots
are inserted. Original source lines are retained (blank lines omitted).
"""
from pathlib import Path
import hashlib
import json
import math
import re
import subprocess

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
pdfmetrics.registerFont(TTFont('CJK', str(FONT)))
WIDTH, HEIGHT = A4
MARGIN = 36
TITLE = '灰线像素前线游戏软件 V1.0'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dependencies(entry):
    seen = set()

    def visit(path):
        path = path.resolve()
        if path in seen:
            return
        if not path.is_relative_to(ROOT) or path.suffix != '.ts':
            raise ValueError(f'Unexpected source: {path}')
        seen.add(path)
        source = path.read_text()
        for spec in re.findall(r'''(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]''', source):
            if spec.startswith('@/'):
                target = ROOT / spec[2:]
            elif spec.startswith('.'):
                target = path.parent / spec
            else:
                continue
            if not target.suffix:
                target = target.with_suffix('.ts')
            if target.exists() and target.suffix == '.ts':
                visit(target)

    visit(entry)
    return [entry] + sorted(seen - {entry}, key=lambda p: p.relative_to(ROOT).as_posix())


def wrap(text, size, max_width):
    result, buf, length = [], '', 0
    for char in text.expandtabs(2):
        w = pdfmetrics.stringWidth(char, 'CJK', size)
        if length + w > max_width and buf:
            result.append(buf)
            buf, length = '', 0
        buf += char
        length += w
    if buf or not result:
        result.append(buf)
    return result


def page_header(pdf, kind, number, total):
    pdf.setFont('CJK', 10)
    pdf.drawString(MARGIN, HEIGHT - 28, TITLE)
    pdf.drawRightString(WIDTH - MARGIN, HEIGHT - 28, f'{kind}  第{number}/{total}页')
    pdf.setLineWidth(0.4)
    pdf.line(MARGIN, HEIGHT - 35, WIDTH - MARGIN, HEIGHT - 35)


files = dependencies(ROOT / 'minigame/src/main.ts')
records = []
for path in files:
    for line_no, text in enumerate(path.read_text().splitlines(), 1):
        if text.strip():
            records.append((path.relative_to(ROOT).as_posix(), line_no, text))
assert len(records) > 3000
selected = records[:1500] + records[-1500:]
pdf_path = OUT / 'source-code.pdf'
pdf = canvas.Canvas(str(pdf_path), pagesize=A4, pageCompression=1)
pdf.setTitle(TITLE + ' 源程序')
page_evidence, text_pages = [], []
for page_index in range(60):
    rows = selected[page_index * 50:(page_index + 1) * 50]
    size = 9.0
    while True:
        wrapped = [(record, wrap(record[2], size, WIDTH - 2 * MARGIN - 29)) for record in rows]
        count = sum(len(parts) for _, parts in wrapped)
        leading = min(13.8, (HEIGHT - 100) / count)
        if leading >= size * 1.15:
            break
        size -= 0.25
        assert size >= 6.5, f'Unreadable source page {page_index + 1}'
    page_header(pdf, '源程序', page_index + 1, 60)
    pdf.setFont('CJK', 7)
    pdf.drawString(MARGIN, HEIGHT - 49, f'{rows[0][0]}:{rows[0][1]} 至 {rows[-1][0]}:{rows[-1][1]}')
    y = HEIGHT - 66
    for number, (record, parts) in enumerate(wrapped, 1):
        pdf.setFont('CJK', 7)
        pdf.setFillGray(0.4)
        pdf.drawRightString(MARGIN + 19, y, str(number))
        pdf.setFont('CJK', size)
        pdf.setFillGray(0)
        for part in parts:
            pdf.drawString(MARGIN + 29, y, part)
            y -= leading
    assert y > 30
    pdf.showPage()
    page_evidence.append({'page': page_index + 1, 'source_rows': 50, 'rendered_rows': count,
                          'font_size': size, 'first': rows[0][:2], 'last': rows[-1][:2]})
    text_pages.append(TITLE + f'  第{page_index+1}/60页\n' + '\n'.join(r[2] for r in rows))
pdf.save()
(ROOT / 'docs/copyright/source-code.txt').write_text('\n\f\n'.join(text_pages) + '\n')

manual = ROOT / 'docs/copyright/manual.md'
lines = []
for raw in manual.read_text().splitlines():
    if not raw.strip():
        continue
    heading = raw.startswith('#')
    text = re.sub(r'^#{1,6}\s+', '', raw).replace('**', '').replace('`', '')
    if text.startswith('- '):
        text = '· ' + text[2:]
    size = 11 if heading else 10
    lines.extend((part, heading) for part in wrap(text, size, WIDTH - 2 * MARGIN))
page_count = math.ceil(len(lines) / 43)
per_page, extra = divmod(len(lines), page_count)
assert per_page >= 30
pdf = canvas.Canvas(str(OUT / 'manual.pdf'), pagesize=A4, pageCompression=1)
pdf.setTitle(TITLE + ' 软件说明书')
offset = 0
manual_page_rows = []
for i in range(page_count):
    n = per_page + (i < extra)
    rows = lines[offset:offset+n]
    offset += n
    page_header(pdf, '说明书', i+1, page_count)
    y = HEIGHT - 65
    for text, heading in rows:
        pdf.setFont('CJK', 11 if heading else 10)
        pdf.drawString(MARGIN, y, text)
        y -= 16.7
    assert y > 30
    pdf.showPage()
    manual_page_rows.append(n)
pdf.save()

source_reader = PdfReader(pdf_path)
manual_reader = PdfReader(OUT / 'manual.pdf')
assert len(source_reader.pages) == 60
assert len(manual_reader.pages) == page_count
for reader in (source_reader, manual_reader):
    for page in reader.pages:
        assert TITLE in page.extract_text()
        assert round(float(page.mediabox.width)) == round(WIDTH)

evidence = {
    'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'selection': 'Entry first, remaining local TypeScript import dependencies sorted by path; blank lines omitted; first/last 1500 nonempty source lines.',
    'nonempty_source_lines': len(records),
    'source_files': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in files],
    'source_pages': page_evidence,
    'manual_sha256': digest(manual),
    'manual_page_rows': manual_page_rows,
    'outputs': {p.name: {'sha256': digest(p), 'bytes': p.stat().st_size} for p in [pdf_path, OUT / 'manual.pdf']},
    'status': 'Prepared; not submitted. Applicant identity, ownership and publication details require confirmation.',
}
(OUT / 'copyright-evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'source_files': len(files), 'source_lines': len(records), 'source_pdf_pages': 60,
                  'min_font_size': min(p['font_size'] for p in page_evidence),
                  'manual_page_rows': manual_page_rows, 'outputs': evidence['outputs']}, ensure_ascii=False))
