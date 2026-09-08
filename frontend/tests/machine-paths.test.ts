import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

/* Variables that exist on Windows and nowhere else, and the drive letter
   that means the same thing. pnpm, npm, docker and compose all
   interpolate ${VAR} out of their own config, so a path written this way
   reads as portable and is not: on the deploy host the variable is
   missing and the tool refuses before it does anything. Compose's
   ${POSTGRES_USER:-impromptu} is fine and stays fine, because what is
   named here is one machine and not a setting. */
const PATTERNS = [
  /\$\{?(LOCALAPPDATA|APPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|PROGRAMFILES|PROGRAMDATA|SYSTEMROOT)\b/i,
  /%(LOCALAPPDATA|APPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|PROGRAMFILES|PROGRAMDATA|SYSTEMROOT)%/i,
  /(^|["'\s=:(])[A-Za-z]:[\\/]/,
];

/* Prose may quote a Windows path, and the record of this rule does. What
   is checked is what a tool reads to configure itself. This file names
   the variables it forbids, which is the one place they belong. */
const PROSE = /^docs\/|\.md$/;
const SELF = "frontend/tests/machine-paths.test.ts";
const BINARY = /\.(png|ico|woff2)$/;

function tracked(): string[] {
  const listing = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  return listing.split("\0").filter((name) => name && name !== SELF && !PROSE.test(name) && !BINARY.test(name));
}

describe("what is committed", () => {
  it("never names one machine, so a checkout on the deploy host configures the same tools the same way", () => {
    /* The failure this pins: frontend/pnpm-workspace.yaml carried
       storeDir: "${LOCALAPPDATA}/pnpm/store" from the foundation commit,
       and pnpm on Linux answered every command, build included, with
       "Failed to replace env in config". It was the Windows default
       written out by hand, so nothing on Windows could ever notice. */
    const offenders = tracked().filter((name) => PATTERNS.some((p) => p.test(readFileSync(path.join(ROOT, name), "utf8"))));
    expect(offenders).toEqual([]);
  });
});
