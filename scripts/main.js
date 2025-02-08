// Process All Sprite but slow for fast performance use custom.js and autogen.js 

import fs from "fs";
import sharp from "sharp";
import path from "path";

const SPRITE_SIZE = 288;
const COLUMNS_BASE = 10;
const COLUMNS_AUTOGEN = 10;
const COLUMNS_CUSTOM = 20;

const lettersToIndex = (letters) => {
  if (!letters) return 0;
  letters = letters.toLowerCase();
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - "a".charCodeAt(0) + 1);
  }
  return index;
};

const PATHS = {
  input: {
    base: "./GrameGraphics/CustomBattlers/spritesheets/spritesheets_base",
    custom: "./GrameGraphics/CustomBattlers/spritesheets/spritesheets_custom",
    autogen: "./GrameGraphics/Battlers/spritesheets_autogen"
  },
  output: {
    base: "./Graphics/base",
    custom: "./Graphics/custom",
    autogen: "./Graphics/autogen"
  }
};


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

    case "autogen":
      const autogenIndex = parseInt(bodyId, 10);
      return {
        x: (autogenIndex % COLUMNS_AUTOGEN) * SPRITE_SIZE,
        y: Math.floor(autogenIndex / COLUMNS_AUTOGEN) * SPRITE_SIZE,
      };

    default:
      return null;
  }
};


const processSpriteId = (sprite) => {
  // Handle autogen sprites
  if (sprite.isAutogen) {
    return {
      type: 'autogen',
      headId: sprite.headId,
      bodyId: sprite.bodyId,
      outputPath: path.join(PATHS.output.autogen, sprite.headId, `${sprite.headId}.${sprite.bodyId}.png`),
      inputPath: path.join(PATHS.input.autogen, `${sprite.headId}.png`),
      index: parseInt(sprite.bodyId) - 1
    };
  }

  const { sprite_id, base_id, type } = sprite;
  let headId, bodyId, altLetter = '';
  let isCustom = false;

  if (type === 'alt') {
    // For alt sprites, we need to process both the sprite_id and base_id
    const baseMatches = base_id.split('.');
    headId = baseMatches[0];
    bodyId = baseMatches[1] || '';
    
    // Extract alt letter from sprite_id
    const altMatch = sprite_id.match(/[a-z]+$/i);
    if (altMatch) {
      altLetter = altMatch[0].toLowerCase();
    }
    
    isCustom = !!bodyId;
  } else {
    // Main sprites (non-alt)
    if (base_id.includes('.')) {
      [headId, bodyId] = base_id.split('.');
      isCustom = true;
    } else {
      headId = base_id;
      bodyId = '';
    }
  }

  const category = isCustom ? 'custom' : 'base';
  
  // Build the paths
  let outputFilename, inputPath;
  
  if (isCustom) {
    outputFilename = `${headId}.${bodyId}${altLetter}.png`;
    inputPath = path.join(PATHS.input.custom, headId, `${headId}${altLetter}.png`);
  } else {
    outputFilename = `${headId}${altLetter}.png`;
    inputPath = path.join(PATHS.input.base, `${headId}.png`);
  }

  const outputDir = isCustom ? path.join(PATHS.output.custom, headId) : PATHS.output.base;
  const outputPath = path.join(outputDir, outputFilename);

  // Calculate position in spritesheet
  let index;
  if (altLetter) {
    // Convert letter to index (a=0, b=1, etc.)
    index = altLetter.charCodeAt(0) - 'a'.charCodeAt(0);
  } else if (bodyId) {
    // For fusions, use the body ID as index
    index = parseInt(bodyId) - 1;
  } else {
    // Base sprites are at index 0
    index = 0;
  }


  return {
    type: category,
    headId,
    bodyId,
    altLetter,
    inputPath,
    outputPath,
    index
  };
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

const extractSprite = async (sprite) => {
  try {
    const spriteInfo = processSpriteId(sprite);
    const position = getPosition(spriteInfo);
    
    // console.log(`Extracting from ${spriteInfo.inputPath} to ${spriteInfo.outputPath}`);
    // console.log(`Position: x=${position.x}, y=${position.y}`);
    
    await sharp(spriteInfo.inputPath)
      .extract({
        left: position.x,
        top: position.y,
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
      })
      .toFile(spriteInfo.outputPath);
    
    console.log(`Extracted: ${spriteInfo.outputPath}`);
  } catch (error) {
    console.error(`Error extracting sprite:`, error);
    console.error(`Sprite details:`, sprite);
  }
};

const processAutogenSprites = async () => {
  const files = fs.readdirSync(PATHS.input.autogen)
    .filter(file => file.endsWith('.png'));

  for (const file of files) {
    const headId = path.basename(file, '.png');
    
    for (let bodyId = 1; bodyId <= 501; bodyId++) {
      await extractSprite({
        isAutogen: true,
        headId,
        bodyId: bodyId.toString()
      });
    }
  }
};

const main = async () => {
  try {
    console.log("Creating directories...");
    createDirectories();


   
    console.log("Processing sprites from JSON...");
    const sprites = JSON.parse(fs.readFileSync("./images_dump.json", "utf8"));
    
    for (const sprite of sprites) {
      await extractSprite(sprite);
    }

    
    console.log("\nProcessing autogen sprites...");
    await processAutogenSprites();

    console.log("All sprites processed successfully!");
  } catch (error) {
    console.error("Error in main process:", error);
  }
};

main();