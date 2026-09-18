import { access } from "node:fs/promises";
const required = ["src/server.mjs","src/lib.mjs","public/index.html","public/app.js","public/review.js","public/style.css"];
await Promise.all(required.map(access));
console.log("build check ok");
