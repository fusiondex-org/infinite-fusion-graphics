import fs from "fs";
import sharp from "sharp";
import path from "path";

const SPRITE_SIZE = 288;
const COLUMNS_AUTOGEN = 10;

const PATHS = {
  input: {
    autogen: "./GrameGraphics/Battlers/spritesheets_autogen",
  },
  output: {
    autogen: "./Data/autogen",
  },
};

// Creates output directories
const createDirectories = () => {
  fs.mkdirSync(PATHS.output.autogen, { recursive: true });
  for (let i = 1; i <= 501; i++) {
    fs.mkdirSync(path.join(PATHS.output.autogen, i.toString()), { recursive: true });
  }
};

// Processes a single spritesheet by extracting all sprites
const processSheet = async (file) => {
  const headId = path.basename(file, ".png");
  const inputPath = path.join(PATHS.input.autogen, file);

  try {
    // Load the spritesheet once
    const sheetMetadata = await sharp(inputPath).metadata();
    const rows = Math.ceil(sheetMetadata.height / SPRITE_SIZE);
    const columns = Math.min(COLUMNS_AUTOGEN, Math.ceil(sheetMetadata.width / SPRITE_SIZE));

    console.log(`Processing spritesheet: ${headId}`);
    console.log(`Rows: ${rows}, Columns: ${columns}`);

    for (let bodyId = 1; bodyId <= 501; bodyId++) {
      const index = bodyId;
      const x = (index % columns) * SPRITE_SIZE;
      const y = Math.floor(index / columns) * SPRITE_SIZE;

      if (y >= sheetMetadata.height) {
        console.log(`Skipping sprite ${bodyId} as it exceeds sheet dimensions.`);
        continue;
      }

      const outputPath = path.join(PATHS.output.autogen, headId.toString(), `${headId}.${bodyId}.png`);

      // Extract and save the sprite
      await sharp(inputPath)
        .extract({
          left: x,
          top: y,
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
        })
        .toFile(outputPath);

      console.log(`Extracted: ${outputPath}`);
    }
  } catch (error) {
    console.error(`Error processing sheet ${headId}:`, error);
  }
};

// Processes all autogen spritesheets
const processAutogenSprites = async () => {
  const files = fs
    .readdirSync(PATHS.input.autogen)
    .filter((file) => file.endsWith(".png"));

  for (const file of files) {
    await processSheet(file);
  }
};

const main = async () => {
  try {
    console.log("Creating directories...");
    createDirectories();

    console.log("\nProcessing autogen sprites...");
    await processAutogenSprites();

    console.log("All sprites processed successfully!");
  } catch (error) {
    console.error("Error in main process:", error);
  }
};

main();
