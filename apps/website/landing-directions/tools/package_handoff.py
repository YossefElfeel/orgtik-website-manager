"""Package the frontend deliverable without dependencies or optional server code."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parents[1]
target = root.parent / "OrgTik-Landing-Directions.zip"
prefix = "OrgTik-Landing-Directions"
files = []
for folder in ["src", "public", "dist/client", "qa", "references"]:
    files.extend(p for p in (root / folder).rglob("*") if p.is_file())
for name in ["README.md", "design-qa.md", "THIRD-PARTY-NOTICES.md", "index.html", "vite.config.mjs", "package.json", "package-lock.json"]:
    files.append(root / name)
files.extend((root / "tools").glob("*.py"))

with ZipFile(target, "w", compression=ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as archive:
    for path in sorted(set(files)):
        archive.write(path, f"{prefix}/{path.relative_to(root).as_posix()}")
    for name in ["orgtik-frontend-project-plan.md", "orgtik-website-ia.md"]:
        archive.write(root.parent / name, f"{prefix}/project-plan/{name}")
    archive.writestr(f"{prefix}/PACKAGE-CONTENTS.txt", "Frontend source, static client build, original brand asset exports, video placeholders, visual QA evidence, third-party notices, and project plans.\nNo node_modules, Python environment, FFmpeg binary, original large PDF, or optional hosting/server code is included.\nStart with README.md.\n")

with ZipFile(target) as archive:
    assert archive.testzip() is None, "ZIP CRC validation failed"
    names = archive.namelist()
    assert all(n.startswith(prefix + "/") and ".." not in Path(n).parts for n in names)
    assert not any("/node_modules/" in n or "/worker/" in n or "/dist/server/" in n for n in names)
    assert len([n for n in names if "/public/assets/" in n and n.endswith(".mp4")]) == 6
    assert any(n.endswith("/dist/client/index.html") for n in names)
print(f"Archive: {target}")
print(f"Entries: {len(names)}")
print(f"Size: {target.stat().st_size / 1024 / 1024:.2f} MB")
print(f"SHA256: {hashlib.sha256(target.read_bytes()).hexdigest()}")
print("ZIP integrity and scope checks passed.")
