#!/usr/bin/env python3
"""Assemble the self-contained Auto Stories landing page and legal pages.

Reads page.html (the human-authored template with asset markers) and inlines:
  /*@FONT@*/     -> Roboto variable woff2 as a base64 @font-face   (assets/roboto-inline.css)
  /*@PHOTOS@*/   -> the demo photos as base64 .ph-* classes         (assets/photos.css)
  /*@PRETEXT@*/  -> the Pretext text-layout engine, ESM export      (~/.claude .../vendor/pretext.js)
                    rewritten to expose window.Pretext so a classic <script> can use it.

Emits, all with zero network dependencies:
  index.html    -> full standalone document (open directly / serve via NestJS)
  artifact.html -> body-content only (no doctype/html/head/body) for the Artifact tool
  privacy.html  -> Datenschutzerklärung, from privacy.page.html
  imprint.html  -> Impressum, from imprint.page.html

The legal pages go through the build for exactly one reason: the same Roboto
must be inlined, so they read as the same site and still fetch nothing from a
third party (decision 7.38 — a font from a CDN leaks the visitor's IP, which is
precisely what a privacy policy must not do). They need neither the photos nor
Pretext, so those markers are simply absent from their sources; what they do
share is assets/legal.css at the /*@LEGAL@*/ marker.

Never hand-edit the emitted .html files — edit the .page.html source and re-run.
"""
import os
import re
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
ASSETS = HERE / "assets"
PRETEXT_SRC = pathlib.Path(os.path.expanduser(
    "~/.claude/skills/gstack/design-html/vendor/pretext.js"))


def pretext_as_global(src: str) -> str:
    """Turn the trailing `export{A as name,...}` into `window.Pretext={name:A,...}`."""
    m = re.search(r"export\s*\{([^}]*)\}\s*;?\s*$", src)
    if not m:
        raise SystemExit("could not find Pretext export clause")
    pairs = []
    for part in m.group(1).split(","):
        part = part.strip()
        if not part:
            continue
        local, _as, name = part.partition(" as ")
        name = name.strip() or local.strip()
        pairs.append(f"{name}:{local.strip()}")
    glob = "\nwindow.Pretext={" + ",".join(pairs) + "};\n"
    return src[:m.start()] + glob


def document(body: str, title: str, description: str, lang: str = "en") -> str:
    """Wrap built body content in a standalone HTML document."""
    return (
        f"<!doctype html>\n<html lang=\"{lang}\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>{title}</title>\n"
        f"<meta name=\"description\" content=\"{description}\">\n"
        "</head>\n<body>\n" + body + "\n</body>\n</html>\n"
    )


# The legal pages: authored source -> emitted file, plus <head> metadata.
# `lang` is the document default; each page marks its two halves with lang="de"
# and lang="en" on the sections themselves, so a screen reader switches voice.
LEGAL_PAGES = [
    ("privacy.page.html", "privacy.html", "de",
     "Datenschutzerklärung — Auto Stories",
     "Was Auto Stories mit Ihren Fotos macht, wer sie erhält und wie lange sie "
     "bleiben. Deutsch und English."),
    ("imprint.page.html", "imprint.html", "de",
     "Impressum — Auto Stories",
     "Anbieterkennzeichnung und Kontakt für Auto Stories. Deutsch und English."),
]


def main() -> None:
    page = (HERE / "page.html").read_text()
    font = (ASSETS / "roboto-inline.css").read_text().strip()
    legal_css = (ASSETS / "legal.css").read_text().strip()
    photos = (ASSETS / "photos.css").read_text().strip()
    pretext = pretext_as_global(PRETEXT_SRC.read_text())

    content = (page
               .replace("/*@FONT@*/", font)
               .replace("/*@PHOTOS@*/", photos)
               .replace("/*@PRETEXT@*/", pretext))

    # artifact.html: content only (the Artifact host supplies the skeleton).
    # Prepend a <title> so the artifact is named correctly in the gallery/tab.
    title = "<title>Auto Stories — your photos already have a story</title>\n"
    (HERE / "artifact.html").write_text(title + content)

    # index.html: wrap the same content in a standalone document.
    doc = document(
        content,
        "Auto Stories — your photos already have a story",
        "Auto Stories orders your photos and writes the captions — a finished "
        "Instagram Story in seconds.",
    )
    (HERE / "index.html").write_text(doc)

    print(f"built index.html ({len(doc):,} bytes) + artifact.html ({len(content):,} bytes)")

    # The legal pages: font + shared legal CSS only, no photos, no Pretext.
    for source, out, lang, title, description in LEGAL_PAGES:
        body = ((HERE / source).read_text()
                .replace("/*@FONT@*/", font)
                .replace("/*@LEGAL@*/", legal_css))
        page_doc = document(body, title, description, lang)
        (HERE / out).write_text(page_doc)
        print(f"built {out} ({len(page_doc):,} bytes)")


if __name__ == "__main__":
    main()
