"""Parse the SQL blocks of docs/ajt-design-data-model.md into JSON and fill the ER template.

usage: python3 -I scripts/er/gen_er.py docs/ajt-design-data-model.md scripts/er/er_template.html docs/ajt-er-diagram.html
"""
import json
import re
import sys

doc, tpl, out = sys.argv[1:4]
md = open(doc, encoding="utf-8").read()
sql = "\n".join(re.findall(r"```sql\n(.*?)```", md, re.S))

tables = {}
for m in re.finditer(r"((?:^--[^\n]*\n)*)CREATE TABLE (\w+) \((.*?)\n\);", sql, re.S | re.M):
    pre, name, body = m.group(1), m.group(2), m.group(3)
    note_lines = [l[2:].strip() for l in pre.strip().split("\n") if l.startswith("--") and "-----" not in l]
    cols, last, pending_fks = [], None, []
    for line in body.split("\n"):
        if not line.strip():
            continue
        if line.strip().startswith("--"):
            continue
        pk = re.match(r"^\s+PRIMARY KEY \(([^)]*)\)", line)
        if pk:
            names = [x.strip() for x in pk.group(1).split(",")]
            for c in cols:
                if c["n"] in names:
                    c["pk"] = True
                    c["nn"] = True
                    if len(names) > 1:
                        c["cpk"] = True
            continue
        tfk = re.match(r"^\s+FOREIGN KEY \(([^)]*)\) REFERENCES (\w+)\s*\(([^)]*)\)", line)
        if tfk:
            src = [x.strip() for x in tfk.group(1).split(",")]
            dst = [x.strip() for x in tfk.group(3).split(",")]
            pending_fks.append((src, tfk.group(2), dst))
            continue
        if re.match(r"^\s+(CHECK|UNIQUE|EXCLUDE)\b", line) and not re.match(r"^  [a-z0-9_]+\s", line):
            if last is not None and line.startswith("   "):
                pass  # continuation constraint of last column (e.g. CHECK on next line)
            else:
                continue
        cm = re.match(r"^  ([a-z0-9_]+)\s+([A-Z]+(?:\([^)]*\))?)(.*)$", line)
        if cm:
            code, _, comment = cm.group(3).partition("--")
            last = {"n": cm.group(1), "t": cm.group(2), "code": code, "comment": comment.strip()}
            cols.append(last)
            continue
        if last is not None and line.startswith("   "):
            code, _, comment = line.partition("--")
            last["code"] += " " + code.strip()
            if comment.strip() and not last["comment"]:
                last["comment"] = comment.strip()
    for c in cols:
        code = c.pop("code")
        comment = c.pop("comment")
        c.setdefault("pk", "PRIMARY KEY" in code)
        c["pk"] = c["pk"] or "PRIMARY KEY" in code
        c["nn"] = c.get("nn") or c["pk"] or "NOT NULL" in code
        c["uq"] = bool(re.search(r"\bUNIQUE\b", code))
        ref = re.search(r"REFERENCES (\w+)\((\w+)\)", code)
        if ref:
            c["fk"] = {"t": ref.group(1), "c": ref.group(2)}
        enum = re.search(r"CHECK \(\w+ IN \(([^)]*)\)\)", code)
        if enum:
            c["enum"] = [v.strip().strip("'") for v in enum.group(1).split(",")]
        lk = re.search(r"joins (\w+)\((\w+)\)", comment)
        if lk:
            c["lk"] = {"t": lk.group(1), "c": lk.group(2)}
        tag = re.match(r"([OIC])\b\s*(.*)", comment)
        if tag:
            c["tag"], c["note"] = tag.group(1), tag.group(2)
        elif comment:
            c["note"] = comment
    # Table-level FOREIGN KEY (a, b): draw it from the first listed column that has no FK yet.
    by_name = {c["n"]: c for c in cols}
    for src, tt, dst in pending_fks:
        for sc, dc in zip(src, dst):
            if sc in by_name and "fk" not in by_name[sc]:
                by_name[sc]["fk"] = {"t": tt, "c": dc}
                if len(src) > 1:
                    by_name[sc]["fkCols"] = src
                break
    tables[name] = {"cols": cols, "note": " ".join(note_lines)}

refs = sum(1 for t in tables.values() for c in t["cols"] if "fk" in c)
for t in tables.values():
    for c in t["cols"]:
        for key in ("fk", "lk"):
            if key in c:
                assert c[key]["t"] in tables, c
print(len(tables), "tables", refs, "foreign keys", file=sys.stderr)

html = open(tpl, encoding="utf-8").read()
data = json.dumps(tables, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
assert "/*__DATA__*/" in html
open(out, "w", encoding="utf-8").write(html.replace("/*__DATA__*/", data))
