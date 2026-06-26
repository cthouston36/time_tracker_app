import { rmSync } from "node:fs";
import { resolve } from "node:path";

const nextDirectory = resolve(process.cwd(), ".next");

rmSync(nextDirectory, {
  force: true,
  recursive: true
});
