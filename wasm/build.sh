#!/bin/bash

# Build cubiomes as WebAssembly
# Requires Emscripten SDK to be installed

set -e

CUBIOMES_DIR="../../cubiomes"
OUTPUT_DIR="../public"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Source files from cubiomes
SOURCES="
$CUBIOMES_DIR/noise.c
$CUBIOMES_DIR/biomes.c
$CUBIOMES_DIR/layers.c
$CUBIOMES_DIR/biomenoise.c
$CUBIOMES_DIR/generator.c
$CUBIOMES_DIR/finders.c
$CUBIOMES_DIR/util.c
cubiomes_wrapper.c
"

# Compile to WebAssembly
echo "Compiling cubiomes to WebAssembly..."

emcc $SOURCES \
    -I"$CUBIOMES_DIR" \
    -O3 \
    -fwrapv \
    -sWASM=1 \
    -sMODULARIZE=1 \
    -sEXPORT_NAME="CubiomesModule" \
    -sEXPORTED_FUNCTIONS='["_init_generator", "_apply_seed", "_get_biome_at", "_gen_biomes_2d", "_alloc_biome_buffer", "_free_buffer", "_get_mc_version", "_is_ocean", "_is_snowy_biome", "_get_biome_color", "_get_biome_base_height", "_biome_has_trees", "_get_biome_grass_color", "_malloc", "_free"]' \
    -sEXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "getValue", "setValue"]' \
    -sALLOW_MEMORY_GROWTH=1 \
    -sINITIAL_MEMORY=33554432 \
    -sNO_EXIT_RUNTIME=1 \
    -sENVIRONMENT='web' \
    -o "$OUTPUT_DIR/cubiomes.js"

echo "Build complete! Output in $OUTPUT_DIR/"
echo "Files generated:"
ls -la "$OUTPUT_DIR/cubiomes"*

