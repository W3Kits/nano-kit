import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const indexHtml = path.join(dist, "index.html");
const iconSource = path.join(root, "assets", "w3kits-icon.svg");
const w3kitsDir = path.join(dist, "__w3kits");
const iconTarget = path.join(w3kitsDir, "icon.svg");
const filesToPrune = [
  "article/elegant.jpeg",
  "article/minimal.jpeg",
  "article/nature.jpeg",
  "article/notion.jpeg",
  "article/playful.jpeg",
  "article/sketch.jpeg",
  "article/tech.jpeg",
  "article/warm.jpeg",
  "infographic/ancient-manuscript.jpg",
  "infographic/bilingual-encyclopedia.jpg",
  "infographic/black-neon.jpg",
  "infographic/blackboard-comic.jpg",
  "infographic/chinese-painting-style.jpg",
  "infographic/cornell-notes-stickers.jpg",
  "infographic/expert-whiteboard.jpg",
  "infographic/hand-drawn-visual-notes.jpg",
  "infographic/healing-journal.jpg",
  "infographic/high-end-magazine.jpg",
  "infographic/modern-info-card.jpg",
  "infographic/modern-vector-flat.jpg",
  "infographic/natural-encyclopedia-card.jpg",
  "infographic/naval-modular.jpg",
  "logo-icon.png",
  "logo.png",
  "xhs/bold.jpeg",
  "xhs/cute.jpeg",
  "xhs/fresh.jpeg",
  "xhs/minimal.jpeg",
  "xhs/notion.jpeg",
  "xhs/pop.jpeg",
  "xhs/retro.jpeg",
  "xhs/warm.jpeg",
];

if (!fs.existsSync(indexHtml)) {
  throw new Error("Missing Vite build output: dist/index.html");
}

if (!fs.existsSync(iconSource)) {
  throw new Error("Missing W3Kits icon source: assets/w3kits-icon.svg");
}

fs.mkdirSync(w3kitsDir, { recursive: true });
fs.copyFileSync(iconSource, iconTarget);

for (const relativePath of filesToPrune) {
  const target = path.join(dist, relativePath);
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });
}
