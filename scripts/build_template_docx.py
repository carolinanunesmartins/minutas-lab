#!/usr/bin/env python3
"""Build a styled, tagged contract template (.docx) from the plain-text output
of a drafted contract.

Usage: build_template_docx.py input.txt out_dir [--title "..."]

Writes out_dir/template.docx and out_dir/template.meta.json (skeleton).
The DOCX is created from scratch (no third-party package is reused), so it
carries no author metadata. Layout follows the "classic PT contract" look:
A4, Helvetica 12 pt, justified, 1.5 line spacing, centred bold title,
two-line centred clause headings, bold point numbers, footer "Página X de Y".
"""
import json
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, Twips

BODY_FONT = "Helvetica"
FOOTER_FONT = "Calibri"

RE_CLAUSE = re.compile(r"^CL[AÁ]USULA\s+(\{\{\s*cl\b[^}]*\}\}|[A-ZÁÂÉÊÍÓÔÚÇ ]+)\s*$")
RE_POINT = re.compile(r"^(\{\{\s*pt\b[^}]*\}\}\.)\s+(.*)$")
RE_ALINEA = re.compile(r"^\{\{\s*al\b[^}]*\}\}\)\s+")
RE_BOLD = re.compile(r"(\*\*.+?\*\*)")
RE_SIGN = re.compile(r"^-{3,}$")


def set_font(style, name, size, bold=None):
    style.font.name = name
    style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
        if rfonts.get(qn(attr)) is not None:
            del rfonts.attrib[qn(attr)]
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), name)
    lang = OxmlElement("w:lang")
    lang.set(qn("w:val"), "pt-PT")
    lang.set(qn("w:eastAsia"), "pt-PT")
    rpr.append(lang)


def add_field(paragraph, instr, fmt):
    for kind, text in (("begin", None), ("instr", instr), ("separate", None), ("text", "1"), ("end", None)):
        run = paragraph.add_run()
        fmt(run)
        if kind == "instr":
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        elif kind == "text":
            el = OxmlElement("w:t")
            el.text = text
        else:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), kind)
        run._r.append(el)


def build_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    set_font(normal, BODY_FONT, 12)
    pf = normal.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf.space_before = Twips(80)
    pf.space_after = Twips(120)
    pf.line_spacing = 1.5
    pf.tab_stops.add_tab_stop(Twips(9015), WD_TAB_ALIGNMENT.LEFT, WD_TAB_LEADER.DASHES)

    title = styles["Title"]
    title.base_style = normal
    set_font(title, BODY_FONT, 16, bold=True)
    title.font.color.rgb = None
    title.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(18)
    # remove default bottom border of python-docx's Title style
    ppr = title.element.get_or_add_pPr()
    for b in ppr.findall(qn("w:pBdr")):
        ppr.remove(b)

    clause = styles.add_style("Clausula", WD_STYLE_TYPE.PARAGRAPH)
    clause.base_style = normal
    clause.next_paragraph_style = normal
    set_font(clause, BODY_FONT, 12, bold=True)
    cpf = clause.paragraph_format
    cpf.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cpf.space_after = Pt(0)
    cpf.line_spacing_rule = WD_LINE_SPACING.SINGLE
    cpf.keep_with_next = True
    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:val"), "15")  # 0.75 pt letter spacing
    clause.element.get_or_add_rPr().append(spacing)


def setup_page(doc):
    s = doc.sections[0]
    s.orientation = WD_ORIENT.PORTRAIT
    s.page_width, s.page_height = Twips(11906), Twips(16838)  # A4
    s.top_margin = Twips(1134)
    s.bottom_margin = Twips(1440)
    s.left_margin = Twips(1440)
    s.right_margin = Twips(1440)
    s.header_distance = Twips(709)
    s.footer_distance = Twips(709)
    p = s.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    def fmt(r):
        r.font.name = FOOTER_FONT
        r.font.size = Pt(10)

    for text, field in (("Página ", None), (None, "PAGE"), (" de ", None), (None, "NUMPAGES")):
        if field:
            add_field(p, f" {field} ", fmt)
        else:
            fmt(p.add_run(text))


def add_runs(p, text, bold_all=False):
    for part in RE_BOLD.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            p.add_run(part[2:-2]).bold = True
        else:
            r = p.add_run(part)
            if bold_all:
                r.bold = True


def parse(lines):
    body, fields = [], []
    mode = "body"
    for raw in lines:
        line = raw.rstrip()
        m = re.match(r"^===\s*(.+?)\s*===$", line)
        if m:
            mode = "fields" if m.group(1).upper().startswith("CAMPOS") else "skip"
            continue
        if mode == "body":
            if line.strip():
                body.append(line.strip())
        elif mode == "fields" and "|" in line:
            fields.append([c.strip() for c in line.split("|")])
    return body, fields


def build(input_path, out_dir, title_override=None):
    lines = Path(input_path).read_text(encoding="utf-8").splitlines()
    body, fields = parse(lines)
    doc = Document()
    build_styles(doc)
    setup_page(doc)
    doc.core_properties.author = ""
    doc.core_properties.last_modified_by = ""
    doc.core_properties.title = title_override or ""
    doc.core_properties.comments = ""

    # remove python-docx's initial empty paragraph if any
    for p in list(doc.paragraphs):
        p._element.getparent().remove(p._element)

    first_clause = next((k for k, l in enumerate(body) if RE_CLAUSE.match(l)), len(body))
    for i, line in enumerate(body):
        if i == 0:
            doc.add_paragraph(title_override or line, style="Title")
        elif RE_CLAUSE.match(line):
            doc.add_paragraph(line, style="Clausula")
            if i + 1 < len(body) and body[i + 1].startswith("("):
                pass  # title line handled next iteration
        elif line.startswith("(") and i > 0 and RE_CLAUSE.match(body[i - 1]):
            doc.add_paragraph(line, style="Clausula")
        elif RE_SIGN.match(line):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.add_run("_" * 44)
        elif line.upper() == "ENTRE:":
            p = doc.add_paragraph()
            p.add_run(line).bold = True
            p.add_run("\t")
        else:
            m = RE_POINT.match(line)
            p = doc.add_paragraph()
            if m:
                p.add_run(m.group(1) + " ").bold = True
                add_runs(p, m.group(2))
            else:
                add_runs(p, line)
            if i < first_clause:
                p.add_run("\t")

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    doc.save(out / "template.docx")

    meta = {"id": out.name, "title": title_override or body[0], "version": "0.1.0", "fields": {}}
    for row in fields:
        if not row or not row[0] or row[0].lower() == "id":
            continue
        fid = row[0]
        entry = {}
        if len(row) > 2:
            entry["required"] = row[2].strip().lower() in ("sim", "s", "yes", "y", "true", "obrigatório", "obrigatorio")
        if len(row) > 3 and row[3]:
            entry["label"] = row[3]
        meta["fields"][fid] = entry
    (out / "template.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    title = None
    if "--title" in args:
        title = args[args.index("--title") + 1]
    build(args[0], args[1], title)
    print("ok", args[1])
