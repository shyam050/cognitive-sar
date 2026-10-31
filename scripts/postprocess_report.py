"""Post-process the report docx per toc.md WPS rules:
1. Footer PAGE fields get explicit \\* ROMAN / \\* arabic switches
   (front-matter footer vs body footer, by section order).
2. Remove empty <w:pgNumType/> from the cover section.
"""
import re
import shutil
import zipfile

SRC = r"C:\Users\Shyam\.zcode\workspace\default\cognitive-sar\reports\DA2_Project_Report.docx"
TMP = SRC + ".tmp"

with zipfile.ZipFile(SRC) as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

# --- 1. document.xml: drop empty pgNumType (cover section) ---
doc = data["word/document.xml"].decode("utf-8")
doc = doc.replace("<w:pgNumType/>", "")
data["word/document.xml"] = doc.encode("utf-8")

# --- 2. identify footer order: footer refs appear per section; the front-matter
#       section (UPPER_ROMAN) references the first footer, body (decimal) the second.
#       Find sectPr blocks in order and their footerReference r:ids.
sect_blocks = re.findall(r"<w:sectPr.*?</w:sectPr>|<w:sectPr[^>]*/>", doc, re.S)
fmt_by_rid = {}
for blk in sect_blocks:
    m_fmt = re.search(r'<w:pgNumType[^>]*w:fmt="([^"]+)"', blk)
    for rid in re.findall(r'<w:footerReference[^>]*r:id="([^"]+)"', blk):
        if m_fmt:
            fmt_by_rid[rid] = m_fmt.group(1)

rels = data["word/_rels/document.xml.rels"].decode("utf-8")
rid_to_file = dict(re.findall(r'Id="([^"]+)"[^>]*Target="(footer\d+\.xml)"', rels))

for rid, fmt in fmt_by_rid.items():
    fname = rid_to_file.get(rid)
    if not fname:
        continue
    key = "word/" + fname
    xml = data[key].decode("utf-8")
    switch = "ROMAN" if "upperRoman" in fmt or "roman" in fmt.lower() else "arabic"
    xml = re.sub(r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
                 rf"\1 PAGE \\* {switch} \\* MERGEFORMAT \2", xml)
    data[key] = xml.encode("utf-8")
    print(f"{fname}: fmt={fmt} -> PAGE \\* {switch}")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
shutil.move(TMP, SRC)
print("post-processing done")
