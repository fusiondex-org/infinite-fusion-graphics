import fs from "fs";
import sharp from "sharp";
import path from "path";

const SPRITE_SIZE = 288;
const COLUMNS_BASE = 10;
const COLUMNS_CUSTOM = 20;

const PATHS = {
  input: {
    base: "./GrameGraphics/CustomBattlers/spritesheets/spritesheets_base",
    custom: "./GrameGraphics/CustomBattlers/spritesheets/spritesheets_custom",
    autogen: "./GrameGraphics/Battlers/spritesheets_autogen",
  },
  output: {
    base: "./Data/base",
    custom: "./Data/custom",
    autogen: "./Data/autogen",
  },
};

// Converts letter to index
const lettersToIndex = (letters) => {
  if (!letters) return 0;
  letters = letters.toLowerCase();
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - "a".charCodeAt(0) + 1);
  }
  return index;
};

// Gets position for sprite extraction
const getPosition = (spriteInfo) => {
  const { type, headId, bodyId, altLetter } = spriteInfo;

  switch (type) {
    case "base":
      const letterIndex = lettersToIndex(altLetter);
      return {
        x: (letterIndex % COLUMNS_BASE) * SPRITE_SIZE,
        y: Math.floor(letterIndex / COLUMNS_BASE) * SPRITE_SIZE,
      };

    case "custom":
      const bodyIndex = parseInt(bodyId, 10);
      return {
        x: (bodyIndex % COLUMNS_CUSTOM) * SPRITE_SIZE,
        y: Math.floor(bodyIndex / COLUMNS_CUSTOM) * SPRITE_SIZE,
      };

    default:
      return null;
  }
};

// Processes a sprite's metadata
const processSpriteId = (sprite) => {
  const { sprite_id, base_id, type } = sprite;
  let headId, bodyId, altLetter = "";
  let isCustom = false;

  if (type === "alt") {
    const baseMatches = base_id.split(".");
    headId = baseMatches[0];
    bodyId = baseMatches[1] || "";

    const altMatch = sprite_id.match(/[a-z]+$/i);
    if (altMatch) {
      altLetter = altMatch[0].toLowerCase();
    }

    isCustom = !!bodyId;
  } else {
    if (base_id.includes(".")) {
      [headId, bodyId] = base_id.split(".");
      isCustom = true;
    } else {
      headId = base_id;
      bodyId = "";
    }
  }

  const category = isCustom ? "custom" : "base";
  const inputPath = isCustom
    ? path.join(PATHS.input.custom, headId, `${headId}${altLetter}.png`)
    : path.join(PATHS.input.base, `${headId}.png`);
  const outputDir = isCustom
    ? path.join(PATHS.output.custom, headId)
    : PATHS.output.base;
  const outputFilename = isCustom
    ? `${headId}.${bodyId}${altLetter}.png`
    : `${headId}${altLetter}.png`;
  const outputPath = path.join(outputDir, outputFilename);

  let index;
  if (altLetter) {
    index = altLetter.charCodeAt(0) - "a".charCodeAt(0);
  } else if (bodyId) {
    index = parseInt(bodyId) - 1;
  } else {
    index = 0;
  }

  return {
    type: category,
    headId,
    bodyId,
    altLetter,
    inputPath,
    outputPath,
    index,
  };
};

// Extracts a sprite using Sharp
const extractSprite = async (spriteInfo) => {
  try {
    const position = getPosition(spriteInfo);

    await sharp(spriteInfo.inputPath)
      .extract({
        left: position.x,
        top: position.y,
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      })
      .toFile(spriteInfo.outputPath);

      console.log(position)
    console.log(`Extracted: ${spriteInfo.outputPath}`);
  } catch (error) {
    console.error(`Error extracting sprite:`, error);
    console.error(`Sprite details:`, spriteInfo);
  }
};

// Processes base sprites in batches
const processBaseSprites = async (sprites) => {
  const groupedByHeadId = sprites.reduce((groups, sprite) => {
    const { headId } = sprite;
    if (!groups[headId]) groups[headId] = [];
    groups[headId].push(sprite);
    return groups;
  }, {});

  for (const headId in groupedByHeadId) {
    const spritesForHead = groupedByHeadId[headId];
    console.log(`Processing base sprites for headId: ${headId}`);
    for (const sprite of spritesForHead) {
      await extractSprite(sprite);
    }
  }
};

// Processes custom sprites in batches
const processCustomSprites = async (sprites) => {
  const groupedByAltSheet = sprites.reduce((groups, sprite) => {
    const { headId, altLetter } = sprite;
    const key = `${headId}-${altLetter}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(sprite);
    return groups;
  }, {});

  for (const altSheetKey in groupedByAltSheet) {
    const spritesForAltSheet = groupedByAltSheet[altSheetKey];
    console.log(`Processing custom sprites for sheet: ${altSheetKey}`);
    for (const sprite of spritesForAltSheet) {
      await extractSprite(sprite);
    }
  }
};

const createDirectories = () => {
  Object.values(PATHS.output).forEach(baseDir => {
    fs.mkdirSync(baseDir, { recursive: true });
    
    // Create numbered directories for custom and autogen
    if (baseDir !== PATHS.output.base) {
      for (let i = 1; i <= 501; i++) {
        fs.mkdirSync(path.join(baseDir, i.toString()), { recursive: true });
      }
    }
  });
};

// Main function to process all sprites
const main = async () => {
  try {
    console.log("Creating directories...");
    createDirectories();

    console.log("Reading sprites from JSON...");
    const sprites = JSON.parse(fs.readFileSync("./images_dump.json", "utf8"));
    const processedSprites = sprites.map(processSpriteId);

    const baseSprites = processedSprites.filter(
      (sprite) => sprite.type === "base"
    );
    const customSprites = processedSprites.filter(
      (sprite) => sprite.type === "custom"
    );

    console.log("\nProcessing base sprites...");
    await processBaseSprites(baseSprites);

    console.log("\nProcessing custom sprites...");
    await processCustomSprites(customSprites);

    console.log("All sprites processed successfully!");
  } catch (error) {
    console.error("Error in main process:", error);
  }
};

main();
