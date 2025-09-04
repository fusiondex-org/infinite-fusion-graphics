// Install necessary packages:
// npm install node-fetch@2 cheerio

const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://www.fusiondex.org';
const START_DEX_ID = 501;
const END_DEX_ID = 600; // As per your request
const DELAY_MS = 200; // Delay between requests (milliseconds) - be polite to the server

const allPokemonData = {};

/**
 * Scrapes data for a single Pokémon page.
 * @param {number} dexId The Dex ID of the Pokémon to scrape.
 * @returns {Promise<object|null>} A promise that resolves to the Pokémon data object, or null if an error occurs or page not found.
 */
async function scrapePokemonPage(dexId) {
    const url = `${BASE_URL}/${dexId}/`;
    console.log(`Scraping Dex ID ${dexId} from ${url}...`);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`[WARNING] Page not found for Dex ID ${dexId}. Skipping.`);
                return null; // Page doesn't exist for this ID
            }
            throw new Error(`HTTP error! Status: ${response.status} for ${url}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);

        const article = $('article.dex-entry.sprite-variant-main');
        if (article.length === 0) {
            console.warn(`[WARNING] Could not find the target HTML block for Dex ID ${dexId}. Skipping.`);
            return null; // The expected HTML structure was not found
        }

        const pokemon = {};

        // 1. ID and Full Name
        const headerH2 = article.find('header h2');
        const dexIdSpan = headerH2.find('.dex-id');

        pokemon.id = dexIdSpan.text().replace('#', '').trim();
        pokemon.fullName = headerH2.text().replace(dexIdSpan.text(), '').trim();

        // 2. Types
        pokemon.types = [];
        article.find('section.types .type span[class^="type-"]').each((i, el) => {
            pokemon.types.push($(el).text().trim());
        });

        // 3. Stats (HP, Attack, Defense, etc.)
        const statsMap = {
            'base_hp': 'hp',
            'base_atk': 'attack',
            'base_def': 'defense',
            'base_sp_atk': 'specialAttack',
            'base_sp_def': 'specialDefense',
            'base_spd': 'speed',
            'total': 'total'
        };

        article.find('dl.stats dt').each((i, el) => {
            const dtClass = $(el).attr('class');
            const ddValue = $(el).nextAll(`dd.${dtClass}`).first().text().trim();
            if (statsMap[dtClass]) {
                pokemon[statsMap[dtClass]] = parseInt(ddValue, 10);
            }
        });

        // 4. Height, Weight, Category
        const dataMap = {
            'height': 'height',
            'weight': 'weight',
            'category': 'category'
        };

        article.find('dl.data dt').each((i, el) => {
            const dtClass = $(el).attr('class');
            const ddValue = $(el).nextAll(`dd.${dtClass}`).first().text().trim();
            if (dataMap[dtClass]) {
                pokemon[dataMap[dtClass]] = ddValue;
            }
        });

        // 5. Abilities (NOT present in the provided HTML, so omitted from output)
        // If you need abilities, please provide the HTML structure for it.

        return pokemon;

    } catch (error) {
        console.error(`[ERROR] Failed to scrape Dex ID ${dexId}: ${error.message}`);
        return null;
    }
}

/**
 * Main function to orchestrate the scraping process.
 */
async function main() {
    console.log(`Starting scraping process for Dex IDs ${START_DEX_ID} to ${END_DEX_ID}...`);

    for (let i = START_DEX_ID; i <= END_DEX_ID; i++) {
        const pokemon = await scrapePokemonPage(i);
        if (pokemon && pokemon.fullName) {
            // Use fullName as the key as requested in the output format
            allPokemonData[pokemon.fullName] = pokemon;
        }
        // Wait for a bit before the next request
        // await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    // Save all collected data to a JSON file
    const outputPath = 'fusiondex_data.json';
    try {
        fs.writeFileSync(outputPath, JSON.stringify(allPokemonData, null, 2));
        console.log(`\n--------------------------------------------`);
        console.log(`Scraping complete! Data saved to ${outputPath}`);
        console.log(`Total Pokémon scraped: ${Object.keys(allPokemonData).length}`);
        console.log(`--------------------------------------------`);
    } catch (error) {
        console.error(`[ERROR] Failed to write data to file: ${error.message}`);
    }
}

// Execute the main function
main();