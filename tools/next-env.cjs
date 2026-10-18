// Writes Next's standard next-env.d.ts in the current app when it is missing, so `tsc --noEmit`
// knows Next's types (static images such as *.svg) before the first `next dev` or `next build`.
// The file is git-ignored and Next rewrites it on its next run. Used by each app's "typecheck".
// (`next typegen` does the same, but it needs SWC's native binary, which some sandboxes block.)
const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "next-env.d.ts");
if (!fs.existsSync(file)) {
  fs.writeFileSync(
    file,
    [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      "",
      "// NOTE: This file should not be edited",
      "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
      "",
    ].join("\n"),
  );
}
