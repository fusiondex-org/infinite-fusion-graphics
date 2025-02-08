const betterSqlite3 = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const parse = require("csv-parse/sync");

// Define Database Path
const dbPath = path.resolve(__dirname, "./infinitefusion.sqlite");

// Utility: Parse TXT File into Array
const txtToMap = (dataString) => {
  const spriteMap = new Map();
  const sprites = dataString
    .split("\r\n")
    .filter((line) => line.trim().length > 0) // Ignore empty lines
    .map((line) => line.split(","));

  sprites.forEach(([sprite_id, artists, type, comments]) => {
    let imageType = /[a-zA-Z]/.test(sprite_id) ? "alt" : "main";
    spriteMap.set(sprite_id, [sprite_id, artists, imageType, comments]);
  });

  return spriteMap;
};

// Utility: Extract Base ID from Sprite ID
const getBaseId = (sprite_id) => sprite_id.replace(/[a-zA-Z]+$/, "");

// Initialize Database
const initializeDatabase = (db) => {
  try {
    // Disable foreign key constraints before dropping tables
    db.exec("PRAGMA foreign_keys = OFF;");
    console.log("Dropping tables...");
    db.exec(`
      DROP TABLE IF EXISTS dex_entry;
      DROP TABLE IF EXISTS image_artists;
      DROP TABLE IF EXISTS images;
    `);
    console.log("Tables dropped successfully.");
    // Recreate tables
    db.exec(`
      CREATE TABLE images (
          sprite_id TEXT PRIMARY KEY,
          base_id TEXT,
          type TEXT,
          comments TEXT
      );

      CREATE TABLE image_artists (
          sprite_id TEXT,
          artist_name TEXT,
          FOREIGN KEY (sprite_id) REFERENCES images (sprite_id)
      );

      CREATE TABLE dex_entry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sprite_id TEXT,
          entry TEXT,
          author TEXT
      );
    `);
    console.log("Tables created successfully.");
    // Re-enable foreign key constraints
    db.exec("PRAGMA foreign_keys = ON;");
    // Create Indexes
    db.exec(`
     -- Retain previous indexes
CREATE INDEX IF NOT EXISTS idx_images_base_id ON images (base_id); -- Index for filtering by base_id
CREATE INDEX IF NOT EXISTS idx_images_sprite_id ON images (sprite_id); -- Index for joining and filtering by sprite_id
CREATE INDEX IF NOT EXISTS idx_image_artists_sprite_id ON image_artists (sprite_id); -- Index for joining on sprite_id
CREATE INDEX IF NOT EXISTS idx_dex_entry_sprite_id ON dex_entry (sprite_id); -- Index for joining and filtering by sprite_id
CREATE INDEX IF NOT EXISTS idx_dex_entry_author ON dex_entry (author); -- Index for filtering by author

-- Add new composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_images_base_sprite_id ON images (base_id, sprite_id); -- Composite index for base_id and sprite_id
CREATE INDEX IF NOT EXISTS idx_image_artists_sprite_id_name ON image_artists (sprite_id, artist_name); -- Composite index for sprite_id and artist_name
CREATE INDEX IF NOT EXISTS idx_dex_entry_sprite_id_author ON dex_entry (sprite_id, author); -- Composite index for sprite_id and author

-- Additional indexes for complex query patterns
CREATE INDEX IF NOT EXISTS idx_images_base_id_pattern ON images (base_id); -- Index to optimize base_id filtering with GLOB
CREATE INDEX IF NOT EXISTS idx_images_base_id_sprite_id_comments ON images (base_id, sprite_id, comments); -- Composite index for GROUP BY and partitioning queries
CREATE INDEX IF NOT EXISTS idx_image_artists_artist_name_sprite_id ON image_artists (artist_name, sprite_id); -- Composite index for artist_name filtering
CREATE INDEX IF NOT EXISTS idx_dex_entry_author_count ON dex_entry (author); -- Index for COUNT operations on author
CREATE INDEX IF NOT EXISTS idx_image_artists_artist_name_group ON image_artists (artist_name, sprite_id); -- Index for GROUP_CONCAT operations

  `);

    // Optimize database file
    db.exec("VACUUM;");
  } catch (error) {
    console.error("Error initializing database:", error.message);
  }
};
// Insert Image and Artist Data
const insertImages = (db, dataArr) => {
  console.log("dataArr: ", dataArr.length);
  const insertImage = db.prepare(
    `INSERT INTO images (sprite_id, base_id, type, comments) VALUES (?, ?, ?, ?)`,
  );
  const insertArtist = db.prepare(
    `INSERT INTO image_artists (sprite_id, artist_name) VALUES (?, ?)`,
  );
  try {
    const transaction = db.transaction(() => {
      const processedSpriteIds = new Set();
      dataArr.forEach(([sprite_id, artists, type, comments]) => {
        const base_id = getBaseId(sprite_id);
        // Avoid duplicate entries for images
        if (!processedSpriteIds.has(sprite_id)) {
          insertImage.run(sprite_id, base_id, type, comments);
          processedSpriteIds.add(sprite_id);
          // Insert each artist for the sprite
          artists?.split(" & ")
            ?.forEach((artist) =>
              insertArtist.run(sprite_id, artist.trim() || "Coming Soon (WIP)"),
            );
        } else {
          console.log(`Duplicate sprite_id found: ${sprite_id}`);
        }
      });
    });
    transaction();
    console.log("Image and artist data inserted successfully.");
  } catch (error) {
    console.error("Error inserting images:", error.message);
  }
};
// Insert Dex Entries
const insertDexEntries = (db, dexEntries) => {
  const insertDexEntry = db.prepare(
    `INSERT INTO dex_entry (sprite_id, entry, author) VALUES (?, ?, ?)`,
  );
  try {
    const transaction = db.transaction(() => {
      dexEntries.forEach(({ sprite, entry, author }) => {
        const spriteId = sprite.replace(".png", "");
        const dexEntry = entry.replace("#", "_")
        // console.log(`Inserting dex entry for sprite_id: ${spriteId}`);
        insertDexEntry.run(spriteId, dexEntry, author);
      });
    });
    transaction();
    console.log("Dex entries inserted successfully.");
  } catch (error) {
    console.error("Error inserting dex entries:", error.message);
  }
};

// Function to process sprites and match credits
const allSprites = () => {
  const creditsData = fs.readFileSync(
    path.resolve(__dirname, "./data/credits.txt"),
    "utf-8",
  );
  const spritesData = fs.readFileSync(
    path.resolve(__dirname, "./data/sprites.txt"),
    "utf-8",
  );

  const spriteCredits = txtToMap(creditsData);
  // const creditsMap -
  const spriteIds = spritesData
    .split("\r\n")
    .map((sprite) => sprite.replace(".png", ""));

  spriteIds.forEach((sprite) => {
    let imageType = /[a-zA-Z]/.test(sprite) ? "alt" : "main";
    if (!spriteCredits.has(sprite)) {
      spriteCredits.set(sprite, [sprite, "", imageType, ""]);
    }
  });

  const data = Array.from(spriteCredits.values());

  console.log("Sprite Credits:", data.length);

  // fs.writeFileSync("images.json", JSON.stringify(sprites, null, 2));
  return data;
};

// Main Script Execution
const main = () => {
  const db = betterSqlite3(dbPath);
  console.log("Initializing database...");
  initializeDatabase(db);

  console.log("Processing credits data...");

  const spriteCredits = allSprites();
  console.log(spriteCredits)
  insertImages(db, spriteCredits);

  console.log("Processing dex entries...");
  const dexEntryPath = path.resolve(__dirname, "./data/dex.csv");
  const rowDexData = fs.readFileSync(dexEntryPath, "utf-8");

  // Parsing CSV with proper handling of quotes and commas
  const records = parse.parse(rowDexData, {
    columns: ["sprite", "entry", "author"],
    skip_empty_lines: true,
    trim: true,
  });

  const dexData = records.map((record) => ({
    sprite: record.sprite.trim(),
    entry: record.entry.trim(),
    author: record.author.trim(),
  }));

  insertDexEntries(db, dexData);
  console.log("All data processed successfully.");
  db.close(); // Close database connection
};
// Execute the Script
main();
