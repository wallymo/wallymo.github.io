#!/usr/bin/env python3

import json
import sys
from pathlib import Path

from pypdf import PdfReader


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: pdf_inspect.py <pdf>", file=sys.stderr)
        return 2

    pdf_path = Path(sys.argv[1])
    reader = PdfReader(str(pdf_path))
    uris = []

    for page_number, page in enumerate(reader.pages, start=1):
        for annotation_ref in page.get("/Annots") or []:
            annotation = annotation_ref.get_object()
            action = annotation.get("/A") or {}
            uri = action.get("/URI")
            if uri:
                uris.append({"page": page_number, "uri": str(uri)})

    print(json.dumps({"pages": len(reader.pages), "annotations": uris}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
