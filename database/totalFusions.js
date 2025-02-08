const fs = require("fs");
const betterSqlite3 = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "infinitefusion.sqlite");

const initializeDatabase = (db) => {
  console.log("Database initialized successfully!");
};

const main = () => {
  const db = betterSqlite3(dbPath);
  console.log("Initializing database...");
  initializeDatabase(db);

  const results = {};

  // Loop from 1 to 501 for base Pokémon IDs
  for (let baseId = 1; baseId <= 501; baseId++) {
    // Query for head total fusions
    const headQuery = `
      SELECT COUNT(DISTINCT base_id) AS total_head_fusions
      FROM images
      WHERE base_id LIKE '${baseId}.%'
        AND base_id GLOB '${baseId}.[0-9]*';
    `;

    const bodyQuery = `
      SELECT COUNT(DISTINCT base_id) AS total_body_fusions
      FROM images
      WHERE base_id LIKE '%.${baseId}'
        AND base_id GLOB '*[0-9]*.${baseId}';
    `;

    const headTotalFusions =
      db.prepare(headQuery).get()?.total_head_fusions || 0;
    const bodyTotalFusions =
      db.prepare(bodyQuery).get()?.total_body_fusions || 0;

    // Add results to the object
    results[baseId] = {
      head: headTotalFusions,
      body: bodyTotalFusions,
    };
  }

  // Write results to a JSON file
  const outputPath = path.join(__dirname, "fusion_totals.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  // Log results to the console
  console.log("Fusion totals:", results);
  console.log(`Results written to ${outputPath}`);
};

// Run the main function
main();
