"""Parse the Fandom wiki XML export into site/js/data.js.

Usage: python tools/build_data.py
"""
import glob
import html
import json
import os
import re
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XML = glob.glob(os.path.join(ROOT, "references", "*.xml"))[0]
OUT = os.path.join(ROOT, "site", "js", "data.js")
IMG_DIR = os.path.join(ROOT, "site", "img")

ING_ORDER = [
    "Wheat Dough", "Sauce", "Tomato Sauce", "Pesto Sauce", "Cheese", "Pepperoni", "Sausage",
    "Mushroom", "Olive", "Onion", "Bell Pepper", "Bacon", "Pineapple", "Anchovy", "Ham",
    "Basil", "Eggplant", "Shrimp", "Corn", "Chicken", "Garlic", "Sliced Tomato", "Jalapeno",
    "Avocado", "Truffle", "Fig", "Zucchini", "Artichoke", "Duck", "Peach", "Apple", "Scallop",
]
KNOWN = set(ING_ORDER) | {"Pork Belly", "Tofu", "Potato", "Pumpkin", "Rose Petal", "Chili Bean Sauce"}
ALIASES = {"Mushrooms": "Mushroom", "Sliced Tomatoes": "Sliced Tomato", "Pesto": "Pesto Sauce",
           "Wheat": "Wheat Dough"}

IMAGES = {
    "Dough": "Ingredients_PlainDough-Box", "Wheat Dough": "Ingredients_WheatDough-Box",
    "Sauce": "Tomato_Sauce", "Tomato Sauce": "Tomato_Sauce", "Pesto Sauce": "Pesto_Sauce",
    "Chili Bean Sauce": "Chili_Bean_Sauce", "Cheese": "Ingredients_Cheese-Box",
}
for n in ["Anchovy", "Apple", "Artichoke", "Bacon", "Basil", "Bell Pepper", "Chicken", "Corn",
          "Duck", "Eggplant", "Fig", "Garlic", "Ham", "Jalapeno", "Mushroom", "Olive", "Onion",
          "Peach", "Pepperoni", "Pineapple", "Pork Belly", "Potato", "Pumpkin", "Rose Petal",
          "Sausage", "Scallop", "Shrimp", "Sliced Tomato", "Tofu", "Truffle", "Zucchini"]:
    IMAGES.setdefault(n, "Ingredients_" + n.replace(" ", "_") + "-Box")
IMAGES = {k: v for k, v in IMAGES.items() if os.path.exists(os.path.join(IMG_DIR, v + ".webp"))}


def pages():
    ns = {"m": "http://www.mediawiki.org/xml/export-0.11/"}
    root = ET.parse(XML).getroot()
    for p in root.findall("m:page", ns):
        t = p.find("m:title", ns).text
        txt = p.find("m:revision/m:text", ns).text or ""
        yield t, html.unescape(txt)


def clean(s):
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"\{\{\$\|([\d.,]+)[^}]*\}\}", r"$\1", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", s).strip()


def norm(n):
    n = n.strip()
    return ALIASES.get(n, n)


def parse_pizza(expr):
    """'A + B + (C) + (D)' -> common toppings plus per-half groups"""
    parts, depth, cur = [], 0, ""
    for ch in expr:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "+" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    common, halves, mods = [], [], []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if p.startswith("(") and p.endswith(")"):
            halves.append([norm(x) for x in p[1:-1].split("+") if x.strip() and norm(x) not in ("None", "Nothing")])
            continue
        n = norm(p)
        if n in ("None", "Nothing"):
            continue
        if n.lower() == "well done":
            mods.append("Well done")
        else:
            common.append(n)
    return {"common": common, "halves": halves, "mods": mods}


def parse_recipe(line):
    line = re.sub(r"<br\s*/?>", " ", line, flags=re.I).strip()
    words = re.split(r"[+\[\]()]|\bx\d+\b", line)
    if not any(norm(w) in KNOWN for w in words):
        if line.lower() in ("none", "nothing"):
            return {"kind": "pizza", "pizzas": [{"count": 1, "common": [], "halves": [], "mods": []}]}
        return {"kind": "special", "label": re.sub(r"\s*\((Single|Multiple)\)", r" - \1", line), "pizzas": []}
    pizzas = []
    brackets = list(re.finditer(r"\[(.*?)\](?:\s*x(\d+))?", line))
    if brackets:
        for m in brackets:
            p = parse_pizza(m.group(1))
            p["count"] = int(m.group(2) or 1)
            pizzas.append(p)
    else:
        m = re.search(r"\s+x(\d+)\s*$", line)
        cnt = 1
        if m:
            cnt = int(m.group(1))
            line = line[:m.start()]
        p = parse_pizza(line)
        p["count"] = cnt
        pizzas.append(p)
    return {"kind": "pizza", "pizzas": pizzas}


def parse_block(body):
    lines = body.split("\n")
    first = lines[0].lstrip("| ").strip()
    rec = parse_recipe(first)
    rec["raw"] = re.sub(r"<br\s*/?>", " / ", first, flags=re.I)
    d, notes = {}, []
    for l in lines[1:]:
        m = re.match(r"\|\s*([DN])(\d+)([a-z]?)\s*=\s*(.*)", l)
        if not m:
            continue
        kind, num, suf, val = m.groups()
        val = clean(val)
        if not val:
            continue
        if kind == "D":
            d.setdefault(int(num), {})["q" if not suf else "a" + suf] = val
        else:
            notes.append(val)
    rec["dialogue"] = [d[k] for k in sorted(d)]
    rec["notes"] = notes
    return rec


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse_orders(w):
    start = w.index("== Fixed recipes ==")
    end = w.index("== Trivia ==")
    lines = w[start:end].split("\n")
    sections, entries = [], []
    group = sub = sub2 = None
    cur = None
    in_block, buf = False, []

    def new_section(level, title):
        nonlocal group, sub, sub2, cur
        if level == 2:
            group, sub, sub2 = title, None, None
        elif level == 3:
            sub, sub2 = title, None
        else:
            sub2 = title
        path = [x for x in (group, sub, sub2) if x]
        cur = {"id": slug("-".join(path)), "path": path, "level": level, "notes": []}
        sections.append(cur)

    for l in lines:
        if in_block:
            if l.startswith("}}"):
                in_block = False
                rec = parse_block("\n".join(buf))
                rec["section"] = cur["id"]
                rec["id"] = len(entries)
                entries.append(rec)
            else:
                buf.append(l)
            continue
        m = re.match(r"^(={2,4})\s*(.*?)\s*\1\s*$", l)
        if m:
            new_section(len(m.group(1)), m.group(2))
            continue
        if re.match(r"^\{\{[Oo]rder\s*$", l):
            in_block, buf = True, []
            continue
        if not l.strip() or re.match(r"^(\{\||\|\}|\||!|\{\{|\[\[(File|Category|[a-z-]+:)|__)", l):
            continue
        txt = clean(l.lstrip("*# "))
        if txt and cur is not None:
            cur["notes"].append(txt)
    return sections, entries


def parse_recipe_book(w):
    out = []
    for blk in re.split(r"\n(?==== )", w):
        head = re.match(r"=== (.*?) ===", blk)
        grp = head.group(1) if head else ""
        for row in blk.split("\n|-")[1:]:
            cells = [c.strip() for c in re.split(r"\n\| ", "\n" + row.strip()) if c.strip()]
            if len(cells) < 4:
                continue
            name = clean(cells[1].split("|")[-1])
            unlocked = clean(cells[2].split("|")[-1])
            ing = clean(cells[3].split("|")[-1])
            if not name or not ing:
                continue
            rec = parse_recipe(ing)
            rec.update(name=name, unlocked=unlocked, group=grp, raw=ing)
            out.append(rec)
    return out


def parse_ingredients(pg):
    res = []
    for t, w in pg:
        m = re.search(r"\{\{Ingredient\s*\n(.*?)\n\}\}", w, re.S)
        if not m:
            continue
        f = dict(re.findall(r"^\|\s*(\w+)\s*=\s*(.*)$", m.group(1), re.M))
        res.append({
            "name": t, "type": clean(f.get("type", "")), "unlocked": clean(f.get("unlocked", "")),
            "value": clean(f.get("value", "")), "image": IMAGES.get(t),
        })
    return res


def main():
    pg = list(pages())
    d = dict(pg)
    sections, entries = parse_orders(d["List of orders"])
    book = parse_recipe_book(d["Recipe Book"])
    ings = parse_ingredients(pg)
    have = {i["name"] for i in ings}
    for k in ("Dough", "Wheat Dough", "Tomato Sauce", "Pesto Sauce", "Cheese"):
        if k not in have:
            ings.append({"name": k, "type": "Base", "unlocked": "", "value": "", "image": IMAGES.get(k)})
    tips = []
    m = re.search(r"== Gameplay tips ==\n(.*?)\n==", d["List of orders"], re.S)
    if m:
        tips = [clean(x.lstrip("* ")) for x in m.group(1).split("\n") if x.strip().startswith("*")]
    data = {"sections": sections, "entries": entries, "book": book, "ingredients": ings,
            "images": IMAGES, "tips": tips, "order": ING_ORDER}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf8") as f:
        f.write("window.DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";")
    print(len(entries), "orders;", len(sections), "sections;", len(book), "book recipes;", len(ings), "ingredients;", len(tips), "tips")
    return data


if __name__ == "__main__":
    main()
