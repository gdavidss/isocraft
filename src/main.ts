/**
 * IsoCraft 3D - Minecraft-style isometric world with Three.js
 * Uses cubiomes for Minecraft biome generation
 */

import { inject } from '@vercel/analytics';
import { Game3D } from './game3d/Game3D';

// Initialize Vercel Analytics
inject();

// Extend window for debugging
declare global {
  interface Window {
    game: Game3D;
  }
}

async function main(): Promise<void> {
  const game = new Game3D();
  await game.init();

  // Expose game to console for debugging
  window.game = game;

  console.log('⛏️ IsoCraft 3D initialized!');
  console.log('🌍 Using Three.js with cubiomes for Minecraft biome generation');
  console.log('🎮 Controls: WASD to move, Mouse wheel to zoom');
}

main().catch((error) => {
  console.error('Failed to start game:', error);
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.innerHTML = `
      <div style="color: #ff5555; font-size: 20px; text-shadow: 2px 2px 0 #330000;">Error Loading World</div>
      <div style="color: #aaa; margin-top: 15px; font-size: 14px; text-shadow: 1px 1px 0 #222;">${error.message}</div>
    `;
  }
});
