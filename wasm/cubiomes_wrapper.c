/**
 * Cubiomes WASM Wrapper
 * Exposes cubiomes functionality to JavaScript through Emscripten
 */

#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "generator.h"
#include "biomes.h"

// Global generator instance
static Generator g_generator;
static int g_initialized = 0;

/**
 * Initialize the biome generator for a specific Minecraft version
 * @param mc_version - Minecraft version enum (e.g., MC_1_18 = 31)
 * @param flags - Generator flags (0 for normal, 1 for large biomes)
 */
EMSCRIPTEN_KEEPALIVE
void init_generator(int mc_version, uint32_t flags) {
    setupGenerator(&g_generator, mc_version, flags);
    g_initialized = 1;
}

/**
 * Apply a seed to the generator
 * @param seed_hi - High 32 bits of seed
 * @param seed_lo - Low 32 bits of seed  
 * @param dim - Dimension (0 = overworld, -1 = nether, 1 = end)
 */
EMSCRIPTEN_KEEPALIVE
void apply_seed(uint32_t seed_hi, uint32_t seed_lo, int dim) {
    uint64_t seed = ((uint64_t)seed_hi << 32) | seed_lo;
    applySeed(&g_generator, dim, seed);
}

/**
 * Get biome at a specific position
 * @param scale - 1 for block coordinates, 4 for biome coordinates
 * @param x, y, z - Position coordinates
 * @return Biome ID
 */
EMSCRIPTEN_KEEPALIVE
int get_biome_at(int scale, int x, int y, int z) {
    if (!g_initialized) return -1;
    return getBiomeAt(&g_generator, scale, x, y, z);
}

/**
 * Generate biomes for a 2D area (horizontal slice at y=63)
 * Results are written to the provided buffer
 * @param buffer - Pre-allocated buffer of size sx * sz
 * @param scale - Scale (1, 4, 16, 64, or 256)
 * @param x, z - Starting position
 * @param sx, sz - Size in x and z directions
 * @param y - Y level (typically 63 for surface)
 * @return 0 on success, non-zero on error
 */
EMSCRIPTEN_KEEPALIVE
int gen_biomes_2d(int* buffer, int scale, int x, int z, int sx, int sz, int y) {
    if (!g_initialized || !buffer) return -1;
    
    Range r;
    r.scale = scale;
    r.x = x;
    r.z = z;
    r.sx = sx;
    r.sz = sz;
    r.y = y;  // Keep y in block coordinates - genBiomes handles conversion
    r.sy = 1;
    
    return genBiomes(&g_generator, buffer, r);
}

/**
 * Allocate a buffer for biome generation
 * @param sx, sz - Size in x and z directions
 * @return Pointer to allocated buffer (must be freed with free_buffer)
 */
EMSCRIPTEN_KEEPALIVE
int* alloc_biome_buffer(int sx, int sz) {
    return (int*)malloc(sx * sz * sizeof(int));
}

/**
 * Free a buffer allocated with alloc_biome_buffer
 */
EMSCRIPTEN_KEEPALIVE
void free_buffer(void* buffer) {
    if (buffer) free(buffer);
}

/**
 * Get the Minecraft version constant for a given version string
 */
EMSCRIPTEN_KEEPALIVE
int get_mc_version(int major, int minor) {
    // Map common versions
    if (major == 1) {
        switch (minor) {
            case 21: return MC_1_21;
            case 20: return MC_1_20;
            case 19: return MC_1_19;
            case 18: return MC_1_18;
            case 17: return MC_1_17;
            case 16: return MC_1_16;
            case 15: return MC_1_15;
            case 14: return MC_1_14;
            case 13: return MC_1_13;
            case 12: return MC_1_12;
            default: return MC_1_18; // Default to 1.18
        }
    }
    return MC_1_18;
}

/**
 * Check if a biome is oceanic
 */
EMSCRIPTEN_KEEPALIVE
int is_ocean(int biome_id) {
    return isOceanic(biome_id);
}

/**
 * Check if a biome is snowy
 */
EMSCRIPTEN_KEEPALIVE
int is_snowy_biome(int biome_id) {
    return isSnowy(biome_id);
}

/**
 * Get biome color (RGB packed into int)
 * Returns a default color based on biome type
 */
EMSCRIPTEN_KEEPALIVE
uint32_t get_biome_color(int biome_id) {
    // Minecraft-style biome colors
    switch (biome_id) {
        // Ocean biomes
        case ocean: return 0x000070;
        case deep_ocean: return 0x000030;
        case frozen_ocean: return 0x7070D6;
        case deep_frozen_ocean: return 0x404090;
        case cold_ocean: return 0x202070;
        case deep_cold_ocean: return 0x202050;
        case lukewarm_ocean: return 0x0000AC;
        case deep_lukewarm_ocean: return 0x000080;
        case warm_ocean: return 0x0000FF;
        
        // Land biomes
        case plains: return 0x8DB360;
        case sunflower_plains: return 0xB5DB88;
        case forest: return 0x056621;
        case flower_forest: return 0x2D8E49;
        case birch_forest: return 0x307444;
        case dark_forest: return 0x40511A;
        case taiga: return 0x0B6659;
        case snowy_taiga: return 0x31554A;
        case jungle: return 0x537B09;
        case bamboo_jungle: return 0x768E14;
        case sparse_jungle: return 0x628B17;
        case swamp: return 0x07F9B2;
        case mangrove_swamp: return 0x67352B;
        
        // Dry biomes
        case desert: return 0xFA9418;
        case savanna: return 0xBDB25F;
        case savanna_plateau: return 0xA79D64;
        case badlands: return 0xD94515;
        case wooded_badlands: return 0xB09765;
        case eroded_badlands: return 0xFF6D3D;
        
        // Cold biomes
        case snowy_plains: return 0xFFFFFF;
        case ice_spikes: return 0xB4DCDC;
        case snowy_beach: return 0xFAF0C0;
        case frozen_river: return 0xA0A0FF;
        case snowy_slopes: return 0xA8A8A8;
        case frozen_peaks: return 0xA0A0FF;
        case jagged_peaks: return 0xC0C0C0;
        case stony_peaks: return 0x888888;
        case grove: return 0x4E8A4E;
        
        // Beach/Shore
        case beach: return 0xFADE55;
        case stony_shore: return 0xA2A284;
        
        // River
        case river: return 0x0000FF;
        
        // Mountains
        case windswept_hills: return 0x606060;
        case windswept_forest: return 0x507050;
        case windswept_gravelly_hills: return 0x888888;
        case meadow: return 0x58B858;
        
        // Mushroom
        case mushroom_fields: return 0xFF00FF;
        
        // Cherry
        case cherry_grove: return 0xFFB7C5;
        
        // Caves (won't show on surface but good to have)
        case dripstone_caves: return 0x866043;
        case lush_caves: return 0x7BA331;
        case deep_dark: return 0x0F252F;
        
        // Pale Garden (1.21)
        case pale_garden: return 0xD5CEC7;
        
        default: return 0x808080; // Gray for unknown
    }
}

/**
 * Get terrain height approximation based on biome
 * Returns a value from 0-255
 */
EMSCRIPTEN_KEEPALIVE
int get_biome_base_height(int biome_id) {
    switch (biome_id) {
        // Ocean biomes
        case ocean: return 45;
        case deep_ocean: return 30;
        case frozen_ocean: return 45;
        case deep_frozen_ocean: return 30;
        case cold_ocean: return 45;
        case deep_cold_ocean: return 30;
        case lukewarm_ocean: return 45;
        case deep_lukewarm_ocean: return 30;
        case warm_ocean: return 48;
        
        // Beach
        case beach: return 63;
        case snowy_beach: return 63;
        case stony_shore: return 64;
        
        // River
        case river: return 56;
        case frozen_river: return 56;
        
        // Plains
        case plains: return 68;
        case sunflower_plains: return 68;
        case meadow: return 72;
        
        // Forest biomes
        case forest: return 70;
        case flower_forest: return 70;
        case birch_forest: return 68;
        case dark_forest: return 68;
        case cherry_grove: return 70;
        case pale_garden: return 68;
        
        // Taiga
        case taiga: return 68;
        case snowy_taiga: return 68;
        case grove: return 75;
        
        // Jungle
        case jungle: return 72;
        case bamboo_jungle: return 70;
        case sparse_jungle: return 70;
        
        // Swamp
        case swamp: return 62;
        case mangrove_swamp: return 61;
        
        // Desert/Badlands
        case desert: return 68;
        case badlands: return 80;
        case wooded_badlands: return 82;
        case eroded_badlands: return 75;
        
        // Savanna
        case savanna: return 70;
        case savanna_plateau: return 85;
        
        // Snow/Ice
        case snowy_plains: return 68;
        case ice_spikes: return 68;
        case snowy_slopes: return 90;
        case frozen_peaks: return 110;
        
        // Mountains
        case windswept_hills: return 90;
        case windswept_forest: return 85;
        case windswept_gravelly_hills: return 88;
        case jagged_peaks: return 120;
        case stony_peaks: return 115;
        
        // Mushroom
        case mushroom_fields: return 66;
        
        default: return 64;
    }
}

/**
 * Check if biome should have trees
 */
EMSCRIPTEN_KEEPALIVE
int biome_has_trees(int biome_id) {
    switch (biome_id) {
        case forest:
        case flower_forest:
        case birch_forest:
        case dark_forest:
        case taiga:
        case snowy_taiga:
        case jungle:
        case bamboo_jungle:
        case sparse_jungle:
        case swamp:
        case mangrove_swamp:
        case grove:
        case windswept_forest:
        case cherry_grove:
        case pale_garden:
        case wooded_badlands:
            return 1;
        case plains:
        case meadow:
        case savanna:
            return 2; // Sparse trees
        default:
            return 0;
    }
}

/**
 * Get biome grass color modifier
 * Returns RGB packed into uint32
 */
EMSCRIPTEN_KEEPALIVE
uint32_t get_biome_grass_color(int biome_id) {
    switch (biome_id) {
        case swamp: return 0x6A7039;
        case mangrove_swamp: return 0x8DB127;
        case jungle:
        case bamboo_jungle:
        case sparse_jungle: return 0x59C93C;
        case badlands:
        case wooded_badlands:
        case eroded_badlands: return 0x90814D;
        case dark_forest: return 0x507A32;
        default: return 0x8DB360; // Default grass color
    }
}

