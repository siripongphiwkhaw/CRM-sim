import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

for (const suffix of ["", "-wal", "-shm"]) {
  const file = path.join(DATA_DIR, `crm.db${suffix}`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

// Importing the client triggers schema creation + seeding on an empty DB.
require("./client");

console.log("Database reset and reseeded.");
