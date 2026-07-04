#!/usr/bin/env python3
"""Assemble the self-contained Auto Stories landing page.

Reads page.html (the human-authored template with asset markers) and inlines:
  /*@FONT@*/     -> Roboto variable woff2 as a base64 @font-face   (assets/roboto-inline.css)
  /*@PHOTOS@*/   -> the demo photos as base64 .ph-* classes         (assets/photos.css)
  /*@PRETEXT@*/  -> the Pretext text-layout engine, ESM export      (~/.claude .../vendor/pretext.js)
                    rewritten to expose window.Pretext so a classic <script> can use it.

Emits two files, both with zero network dependencies:
  index.html    -> full standalone document (open directly / serve via NestJS)
  artifact.html -> body-content only (no doctype/html/head/body) for the Artifact tool
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


def main() -> None:
    page = (HERE / "page.html").read_text()
    font = (ASSETS / "roboto-inline.css").read_text().strip()
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
    doc = (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        "<title>Auto Stories — your photos already have a story</title>\n"
        "<meta name=\"description\" content=\"Auto Stories orders your photos and writes the captions — a finished Instagram Story in seconds.\">\n"
        "</head>\n<body>\n" + content + "\n</body>\n</html>\n"
    )
    (HERE / "index.html").write_text(doc)

    print(f"built index.html ({len(doc):,} bytes) + artifact.html ({len(content):,} bytes)")


if __name__ == "__main__":
    main()
