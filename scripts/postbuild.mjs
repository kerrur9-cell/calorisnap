import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcStatic = path.join(rootDir, ".next", "static");
const destStatic = path.join(rootDir, ".next", "_next", "static");
const srcPublic = path.join(rootDir, "public");
const destNext = path.join(rootDir, ".next");

try {
  if (fs.existsSync(srcStatic)) {
    fs.mkdirSync(destStatic, { recursive: true });
    fs.cpSync(srcStatic, destStatic, { recursive: true });
    console.log("Successfully mirrored .next/static to .next/_next/static for CDN compatibility.");
  }
} catch (err) {
  console.warn("Notice: could not mirror static assets:", err);
}

try {
  if (fs.existsSync(srcPublic)) {
    fs.cpSync(srcPublic, destNext, { recursive: true });
    console.log("Successfully copied public/ assets into .next/ for direct root serving.");
  }
} catch (err) {
  console.warn("Notice: could not copy public assets:", err);
}
