/**
 * IsoCraft 3D - Three.js based isometric Minecraft world
 * Uses actual 3D rendering for simpler coordinate handling
 */

import * as THREE from 'three';
import { ChunkManager3D, isDoorBlock } from './ChunkManager3D';
import { Player3D } from './Player3D';
import { BlockHighlight3D, getFaceFromNormal } from './BlockHighlight3D';
import { DebugUI3D } from './DebugUI3D';
import { TextureManager3D } from './TextureManager3D';
import { InventoryHUD } from './InventoryHUD';
import { ShaderDebugUI } from './ShaderDebugUI';
import { DroppedItemManager } from './DroppedItemManager';
import { BlockBreaking } from './BlockBreaking';
import { Crosshair } from './Crosshair';
import { createChunkGenerator, type ChunkGenerator } from '../world/ChunkGenerator';
import { BlockType, LeavesToSaplingBlockType, SAPLING_DROP_CHANCE } from '../world/types';
import { getSoundManager } from './SoundManager';
import { getMusicManager } from './MusicManager';
import { PauseMenu, type VideoSettings } from './PauseMenu';
import { updateAllMaterials } from './ShaderDebugUI';
import { SwimDebugUI } from './SwimDebugUI';
import { 
  getGamepadManager, 
  GameAction,
  JumpCommand,
  CrouchCommand,
  AttackCommand,
  UseCommand,
  InventorySlotCommand,
  OpenInventoryCommand,
} from './GamepadManager';
import { CreativeInventory } from './CreativeInventory';
import { PlayerPhysics, type PhysicsWorld } from './PlayerPhysics';
import { MobileControls, isMobileDevice } from './MobileControls';

// Constants
export const BLOCK_SIZE = 1; // 1 unit = 1 block in 3D space
export const CHUNK_SIZE = 16;
export const WATER_HEIGHT = 7 / 9; // Water surface height
export const PLAYER_REACH = 5.4; // Max distance player can break blocks (20% further than Minecraft survival)

export class Game3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  private chunkManager: ChunkManager3D | null = null;
  private player: Player3D | null = null;
  private playerPhysics: PlayerPhysics | null = null;
  private blockHighlight: BlockHighlight3D | null = null;
  private debugUI: DebugUI3D;
  private shaderDebugUI: ShaderDebugUI;
  private swimDebugUI: SwimDebugUI;
  private textureManager: TextureManager3D;
  
  // Adjustable water swim Y offset (controlled by debug UI)
  // Lower value = player is deeper in water (water plane covers more of body)
  private waterSwimYOffset = 0.0;
  private inventoryHUD: InventoryHUD;
  private droppedItemManager: DroppedItemManager | null = null;
  private blockBreaking: BlockBreaking | null = null;
  private crosshair: Crosshair;
  private pauseMenu: PauseMenu;
  private creativeInventory: CreativeInventory;
  
  private generator: ChunkGenerator | null = null;
  private seed: number;
  
  // Block breaking state
  private targetedBlockPos: THREE.Vector3 | null = null;
  private isMouseDown: boolean = false; // Track if mouse button is held
  private hasValidTarget: boolean = false; // Track if crosshair is over a valid block
  
  // Gamepad state
  private isGamepadAttacking: boolean = false;
  private isGamepadCrouching: boolean = false;
  
  // Mobile controls
  private mobileControls: MobileControls | null = null;
  private mobileMovement = { x: 0, y: 0 };
  private isMobileTouchBreaking = false;
  
  private clock: THREE.Clock;
  private isInitialized = false;
  private isPaused = false;
  
  // Camera settings for isometric view
  private cameraDistance = 50;
  private zoom = 10; // Orthographic zoom (smaller = more zoomed in)

  constructor() {
    // Random seed
    this.seed = Math.floor(Math.random() * 2147483647);
    
    // Create renderer with shadow support
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x87CEEB); // Sky blue
    
    // Enable shadow mapping with soft shadows (hides edge swimming)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 200);
    
    // Create isometric orthographic camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * aspect, this.zoom * aspect,
      this.zoom, -this.zoom,
      0.1, 1000
    );
    
    // Position camera for isometric view (looking down at 45° angle from corner)
    this.setupIsometricCamera();
    
    // Add lights
    this.setupLights();
    
    // Create managers
    this.textureManager = new TextureManager3D();
    this.debugUI = new DebugUI3D();
    this.shaderDebugUI = new ShaderDebugUI();
    this.swimDebugUI = new SwimDebugUI();
    this.inventoryHUD = new InventoryHUD();
    this.crosshair = new Crosshair();
    this.pauseMenu = new PauseMenu();
    this.creativeInventory = new CreativeInventory(this.inventoryHUD);
    
    // Connect swim debug UI callbacks
    this.swimDebugUI.setOnChange((settings) => {
      if (this.player) {
        this.player.setSwimPose(settings);
      }
    });
    this.swimDebugUI.setOnWaterYChange((offset) => {
      this.waterSwimYOffset = offset;
    });
    this.clock = new THREE.Clock();
    
    // Set up pause menu callbacks
    this.pauseMenu.onResume = () => {
      this.isPaused = false;
      this.crosshair.setVisible(true);
      if (this.mobileControls && isMobileDevice()) this.mobileControls.setVisible(true);
    };
    this.pauseMenu.onToggleDebug = () => {
      this.debugUI.toggleVisibility();
    };
    this.pauseMenu.onSettingsChange = (settings) => {
      this.applyVideoSettings(settings.video);
      console.log('Settings updated:', settings);
    };
    
    // Set up creative inventory callbacks
    this.creativeInventory.onOpen = () => {
      this.isPaused = true;
      this.crosshair.setVisible(false);
      if (this.mobileControls) this.mobileControls.setVisible(false);
    };
    this.creativeInventory.onClose = () => {
      this.isPaused = false;
      this.crosshair.setVisible(true);
      if (this.mobileControls && isMobileDevice()) this.mobileControls.setVisible(true);
    };
    
    // Initialize mobile controls if on mobile device
    if (isMobileDevice()) {
      this.setupMobileControls();
    }
  }
  
  /**
   * Set up mobile touch controls
   */
  private setupMobileControls(): void {
    this.mobileControls = new MobileControls({
      onMove: (x, y) => {
        this.mobileMovement.x = x;
        this.mobileMovement.y = y;
      },
      onJump: () => {
        if (this.player && !this.isPaused) {
          if (this.player.swimming) {
            // Swim up when in water
            const swimUpSpeed = 3.0;
            if (this.playerPhysics) {
              const waterSurfaceY = this.playerPhysics.calculateTargetY(
                this.player.position.x,
                this.player.position.z,
                this.player.position.y,
                true
              );
              const newY = this.player.position.y + swimUpSpeed * 0.1;
              this.player.position.y = Math.min(newY, waterSurfaceY);
            }
          } else {
            this.player.jump();
          }
        }
      },
      onOpenInventory: () => {
        if (!this.isPaused) {
          this.creativeInventory.toggle();
        }
      },
      onZoom: (delta) => {
        if (!this.isPaused) {
          this.zoom += delta;
          this.zoom = Math.max(5, Math.min(26, this.zoom));
          this.updateCameraZoom();
        }
      },
      onBreakStart: (screenX, screenY) => {
        if (!this.isPaused) {
          this.isMobileTouchBreaking = true;
          this.updateBlockHighlight(screenX, screenY);
        }
      },
      onBreakEnd: () => {
        this.isMobileTouchBreaking = false;
        if (this.blockBreaking) {
          this.blockBreaking.stopBreaking();
        }
      },
      onPlace: (screenX, screenY) => {
        if (!this.isPaused) {
          // Update highlight to touch position first
          this.updateBlockHighlight(screenX, screenY);
          // Then place block
          this.placeBlock();
        }
      },
      onCrosshairMove: (screenX, screenY) => {
        if (!this.isPaused) {
          // Move crosshair to touch position
          this.crosshair.moveBy(
            screenX - this.crosshair.getPosition().x,
            screenY - this.crosshair.getPosition().y
          );
          // Update block highlight
          this.updateBlockHighlight(screenX, screenY);
        }
      },
    });
    
    // On mobile, show system cursor since we use touch
    document.body.style.cursor = '';
  }
  
  /**
   * Apply video settings
   */
  private applyVideoSettings(video: VideoSettings): void {
    // Apply zoom
    if (video.zoom !== this.zoom) {
      this.zoom = video.zoom;
      this.updateCameraZoom();
    }
    
    // Apply render distance (only if chunk manager exists)
    if (this.chunkManager) {
      this.chunkManager.setRenderDistance(video.renderDistance);
      
      // Apply graphics quality to LOD system
      // "low" graphics = more aggressive LOD (hide trees sooner when zoomed out)
      this.chunkManager.setFastGraphics(video.graphicsQuality === 'low');
      
      // Apply zoom for LOD calculations
      this.chunkManager.setZoom(this.zoom);
    }
    
    // Apply graphics quality
    const pixelRatios = { low: 1, medium: 1.5, high: Math.min(window.devicePixelRatio, 2) };
    this.renderer.setPixelRatio(pixelRatios[video.graphicsQuality]);
    
    // Apply fog
    if (video.fogEnabled && !this.scene.fog) {
      this.scene.fog = new THREE.Fog(0x87CEEB, 100, 200);
    } else if (!video.fogEnabled && this.scene.fog) {
      this.scene.fog = null;
    }
    
    // Apply shader effects
    updateAllMaterials({ shaderEnabled: video.shaderEnabled });
  }

  /**
   * Set up the isometric camera angle
   */
  private setupIsometricCamera(): void {
    // Isometric angle: camera looks down at ~35.264° (arctan(1/√2))
    // and rotated 45° around Y axis
    const angle = Math.atan(1 / Math.sqrt(2)); // ~35.264°
    
    // Position camera
    const d = this.cameraDistance;
    this.camera.position.set(d, d, d);
    this.camera.lookAt(0, 0, 0);
    
    // Rotate for proper isometric view
    this.camera.up.set(0, 1, 0);
  }

  /**
   * Set up scene lighting with shadow support
   */
  private setupLights(): void {
    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    
    // Directional light (sun) - user tuned position
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(15, 200, 160); // Shadows fall east
    
    // Enable shadow casting
    sun.castShadow = true;
    
    // Shadow map size (higher = less shadow swimming)
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    
    // Shadow camera frustum - must cover visible area
    // For isometric view with zoom ~10, visible area is roughly 40-50 units
    const shadowSize = 80;
    sun.shadow.camera.left = -shadowSize;
    sun.shadow.camera.right = shadowSize;
    sun.shadow.camera.top = shadowSize;
    sun.shadow.camera.bottom = -shadowSize;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 300;
    
    // Shadow bias to prevent shadow acne (user tuned)
    sun.shadow.bias = -0.0041;
    sun.shadow.normalBias = 0.005;
    sun.shadow.radius = 2; // Soft shadow edges (reduces swimming)
    
    // IMPORTANT: Add target to scene for it to work
    this.scene.add(sun.target);
    
    // Store reference to update shadow camera position
    (this as any).sunLight = sun;
    
    // Shadow offset values (user tuned for east-facing shadows)
    (this as any).shadowOffset = { x: 15, y: 200, z: 160 };
    
    this.scene.add(sun);
    
    // Hemisphere light for sky/ground color variation
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d5c3d, 0.3);
    this.scene.add(hemi);
  }

  /**
   * Initialize the game
   */
  async init(): Promise<void> {
    const loadingEl = document.getElementById('loading');
    
    // Add canvas to page
    document.body.appendChild(this.renderer.domElement);
    
    // Disable browser touch gestures on canvas for mobile
    if (isMobileDevice()) {
      this.renderer.domElement.style.touchAction = 'none';
    }
    
    // Update loading
    if (loadingEl) {
      loadingEl.querySelector('.loading-text')!.textContent = 'Loading Textures...';
    }
    
    // Load textures
    await this.textureManager.loadTextures();
    
    // Update loading
    if (loadingEl) {
      loadingEl.querySelector('.loading-text')!.textContent = 'Initializing World...';
    }
    
    // Create chunk generator (uses existing cubiomes WASM)
    this.generator = await createChunkGenerator(this.seed);
    
    // Create chunk manager
    this.chunkManager = new ChunkManager3D(
      this.scene,
      this.generator,
      this.textureManager
    );
    
    // Create player physics component (decoupled from rendering)
    // ChunkManager3D implements PhysicsWorld interface
    this.playerPhysics = new PlayerPhysics(this.chunkManager as PhysicsWorld);
    
    // Create dropped item manager
    this.droppedItemManager = new DroppedItemManager(
      this.scene,
      this.textureManager,
      this.inventoryHUD,
      (x: number, z: number) => this.chunkManager!.getHeightAt(x, z)
    );
    
    // Create block breaking system
    this.blockBreaking = new BlockBreaking(this.scene);
    
    // Preload common sounds
    getSoundManager().preloadCommonSounds();
    
    // Find spawn point
    const spawn = this.findSpawnPoint();
    
    // Create player
    this.player = new Player3D(this.scene, spawn.x, spawn.z);
    this.player.setY(spawn.y);
    
    // Create block highlight
    this.blockHighlight = new BlockHighlight3D(this.scene);
    
    // Set up input handlers
    this.setupInputHandlers();
    
    // Set up gamepad commands
    this.setupGamepadCommands();
    
    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());
    
    // Hide loading screen
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    
    console.log(`⛏️ IsoCraft 3D initialized! Seed: ${this.seed.toString(16)}`);
    console.log('🎮 Controls: WASD to move, Space to jump, C to crouch, Mouse wheel to zoom');
    console.log('🏊 Swimming activates automatically in water!');
    console.log('🎵 Press ESC for game menu and sound settings');
    console.log('📦 Press E to open Creative Inventory');
    
    this.isInitialized = true;
    
    // Start background music
    const music = getMusicManager();
    music.setContext('overworld');
    music.start();
    
    // Apply saved settings from pause menu
    const settings = this.pauseMenu.getSettings();
    if (!settings.showFPS) {
      this.debugUI.toggleVisibility();
    }
    
    // Apply video settings
    this.applyVideoSettings(settings.video);
    
    // Start game loop
    this.animate();
  }

  /**
   * Find a suitable spawn point
   */
  private findSpawnPoint(): { x: number; y: number; z: number } {
    if (!this.generator) return { x: 0, y: 64, z: 0 };
    
    // Search for land
    for (let radius = 0; radius < 1000; radius += 8) {
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const x = Math.floor(Math.cos(angle) * radius);
        const z = Math.floor(Math.sin(angle) * radius);
        
        const height = this.generator.getHeightAt(x, z);
        const biome = this.generator.getBiomeAt(x, z);
        
        // Skip ocean biomes
        if (this.generator.isOcean(biome)) continue;
        
        if (height >= 63 && height <= 80) {
          console.log(`🏠 Spawn found at (${x}, ${height}, ${z})`);
          return { x, y: height + 1, z };
        }
      }
    }
    
    return { x: 0, y: 64, z: 0 };
  }

  /**
   * Set up gamepad commands using the Command pattern
   */
  private setupGamepadCommands(): void {
    const gamepad = getGamepadManager();
    
    // Jump command
    gamepad.registerCommand(
      GameAction.Jump,
      new JumpCommand(() => {
        if (this.player && !this.isPaused) {
          this.player.jump();
        }
      })
    );
    
    // Crouch command (toggle-style for gamepad)
    gamepad.registerCommand(
      GameAction.Crouch,
      new CrouchCommand(
        () => {
          if (this.player && !this.isPaused && !this.player.swimming) {
            this.isGamepadCrouching = !this.isGamepadCrouching;
            this.player.setCrouching(this.isGamepadCrouching);
          }
        }
      )
    );
    
    // Attack command (break blocks)
    gamepad.registerCommand(
      GameAction.Attack,
      new AttackCommand(
        () => {
          if (!this.isPaused) {
            this.isGamepadAttacking = true;
          }
        },
        () => {
          this.isGamepadAttacking = false;
          if (this.blockBreaking) {
            this.blockBreaking.stopBreaking();
          }
        }
      )
    );
    
    // Use command (place blocks)
    gamepad.registerCommand(
      GameAction.Use,
      new UseCommand(() => {
        if (!this.isPaused) {
          this.placeBlock();
        }
      })
    );
    
    // Inventory slot commands
    gamepad.registerCommand(
      GameAction.NextSlot,
      new InventorySlotCommand('next', () => {
        if (!this.isPaused) {
          const current = this.inventoryHUD.getSelectedSlot();
          this.inventoryHUD.selectSlot((current + 1) % 9);
        }
      })
    );
    
    gamepad.registerCommand(
      GameAction.PrevSlot,
      new InventorySlotCommand('prev', () => {
        if (!this.isPaused) {
          const current = this.inventoryHUD.getSelectedSlot();
          this.inventoryHUD.selectSlot((current - 1 + 9) % 9);
        }
      })
    );
    
    // Note: Zoom is handled continuously in the game loop (not as discrete commands)
    // L2 = zoom out, R2 = zoom in (hold to continuously zoom)
    
    // Open inventory command (Triangle / Y button)
    gamepad.registerCommand(
      GameAction.OpenInventory,
      new OpenInventoryCommand(() => {
        // Don't open if pause menu is visible
        if (this.pauseMenu.isMenuVisible()) return;
        
        this.creativeInventory.toggle();
      })
    );
    
    // Pause callback
    gamepad.onPause = () => {
      if (!this.isPaused) {
        this.pauseMenu.toggle();
        this.isPaused = this.pauseMenu.isMenuVisible();
        this.crosshair.setVisible(!this.isPaused);
        if (this.mobileControls) this.mobileControls.setVisible(!this.isPaused && isMobileDevice());
      }
    };
  }
  
  /**
   * Set up keyboard and mouse input
   */
  private setupInputHandlers(): void {
    // Keyboard state
    const keys: Set<string> = new Set();
    
    window.addEventListener('keydown', (e) => {
      // Handle ESC key - closes menus in order of priority
      if (e.code === 'Escape') {
        e.preventDefault();
        
        // Close creative inventory first if open
        if (this.creativeInventory.isInventoryVisible()) {
          this.creativeInventory.hide();
          return;
        }
        
        // Otherwise toggle pause menu
        this.pauseMenu.toggle();
        this.isPaused = this.pauseMenu.isMenuVisible();
        this.crosshair.setVisible(!this.isPaused);
        if (this.mobileControls) this.mobileControls.setVisible(!this.isPaused && isMobileDevice());
        return;
      }
      
      // Handle 'E' key - toggle creative inventory
      if (e.code === 'KeyE') {
        e.preventDefault();
        
        // Don't open if pause menu is visible
        if (this.pauseMenu.isMenuVisible()) return;
        
        this.creativeInventory.toggle();
        return;
      }
      
      // Skip other keys if paused or inventory is open
      if (this.isPaused || this.creativeInventory.isInventoryVisible()) return;
      
      keys.add(e.code);
      
      // Toggle debug with F3
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugUI.toggleVisibility();
        this.pauseMenu.toggleDebugSetting(); // Keep setting in sync
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (this.isPaused || this.creativeInventory.isInventoryVisible()) return;
      keys.delete(e.code);
    });
    
    // Store keys for update loop
    (this as any).keys = keys;
    
    // Mouse wheel for zoom
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom += e.deltaY * 0.02;
      this.zoom = Math.max(5, Math.min(26, this.zoom));
      this.updateCameraZoom();
    }, { passive: false });
    
    // Mouse move for block highlight
    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (this.isPaused) return;
      this.updateBlockHighlight(e.clientX, e.clientY);
      
      // If mouse is down and we moved to a different block, reset breaking
      if (this.isMouseDown && this.blockBreaking) {
        const targetBlock = this.blockBreaking.getTargetBlock();
        if (targetBlock && this.blockHighlight?.isVisible()) {
          const highlightPos = this.blockHighlight.getPosition();
          if (!targetBlock.equals(highlightPos)) {
            // Moved to different block - reset progress
            this.blockBreaking.stopBreaking();
          }
        }
      }
    });
    
    // Mouse down - start breaking blocks (held to break)
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (this.isPaused) return;
      if (e.button === 0) {
        this.isMouseDown = true;
      }
    });
    
    // Mouse up - stop breaking
    this.renderer.domElement.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        // Stop breaking animation
        if (this.blockBreaking) {
          this.blockBreaking.stopBreaking();
        }
      }
    });
    
    // Mouse leave - stop breaking if mouse leaves canvas
    this.renderer.domElement.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      if (this.blockBreaking) {
        this.blockBreaking.stopBreaking();
      }
    });
    
    // Right click to place blocks (prevent context menu)
    this.renderer.domElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.placeBlock();
    });
  }
  
  /**
   * Place a block from inventory on the targeted block's face
   * OR interact with a door (toggle open/close)
   */
  private placeBlock(): void {
    if (!this.blockHighlight || !this.chunkManager || !this.player) return;
    if (!this.blockHighlight.isVisible()) return;
    
    // Get the targeted block position and face
    const targetPos = this.blockHighlight.getPosition();
    const face = this.blockHighlight.getFace();
    
    // Check if the targeted block is a door - if so, toggle it instead of placing
    // Also check one block below since doors are 2 blocks tall but only stored at bottom position
    let targetBlockType = this.chunkManager.getBlockTypeAt(targetPos.x, targetPos.y, targetPos.z);
    let doorY = targetPos.y;
    
    // If not a door at this position, check if we clicked on the top half of a door (door stored below)
    if (targetBlockType === null || !isDoorBlock(targetBlockType)) {
      const belowType = this.chunkManager.getBlockTypeAt(targetPos.x, targetPos.y - 1, targetPos.z);
      if (belowType !== null && isDoorBlock(belowType)) {
        targetBlockType = belowType;
        doorY = targetPos.y - 1;
      }
    }
    
    if (targetBlockType !== null && isDoorBlock(targetBlockType)) {
      // Check reach distance to door
      const doorDx = targetPos.x + 0.5 - this.player.position.x;
      const doorDy = doorY + 0.5 - (this.player.position.y + 0.9);
      const doorDz = targetPos.z + 0.5 - this.player.position.z;
      const doorDistance = Math.sqrt(doorDx * doorDx + doorDy * doorDy + doorDz * doorDz);
      
      if (doorDistance <= PLAYER_REACH) {
        const toggled = this.chunkManager.toggleDoor(targetPos.x, doorY, targetPos.z);
        if (toggled) {
          // Play door sound
          getSoundManager().playBlockPlace(targetBlockType);
          // Play arm animation
          this.player.punch();
        }
      }
      return;
    }
    
    // Calculate placement position based on which face was clicked
    const placePos = targetPos.clone();
    switch (face) {
      case 'top':
        placePos.y += 1;
        break;
      case 'bottom':
        placePos.y -= 1;
        break;
      case 'left':
        placePos.x -= 1;
        break;
      case 'right':
        placePos.x += 1;
        break;
      case 'front':
        placePos.z += 1;
        break;
      case 'back':
        placePos.z -= 1;
        break;
    }
    
    // Check reach distance
    const dx = placePos.x + 0.5 - this.player.position.x;
    const dy = placePos.y + 0.5 - (this.player.position.y + 0.9);
    const dz = placePos.z + 0.5 - this.player.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance > PLAYER_REACH) {
      console.log('📏 Too far to place block');
      return;
    }
    
    // Check if placement position would intersect with player
    const playerX = this.player.position.x;
    const playerY = this.player.position.y;
    const playerZ = this.player.position.z;
    const playerWidth = 0.6;
    const playerHeight = 1.8;
    const halfWidth = playerWidth / 2;
    
    // Check if block would overlap player hitbox
    const blockMinX = placePos.x;
    const blockMaxX = placePos.x + 1;
    const blockMinY = placePos.y;
    const blockMaxY = placePos.y + 1;
    const blockMinZ = placePos.z;
    const blockMaxZ = placePos.z + 1;
    
    const playerMinX = playerX - halfWidth;
    const playerMaxX = playerX + halfWidth;
    const playerMinY = playerY;
    const playerMaxY = playerY + playerHeight;
    const playerMinZ = playerZ - halfWidth;
    const playerMaxZ = playerZ + halfWidth;
    
    if (blockMaxX > playerMinX && blockMinX < playerMaxX &&
        blockMaxY > playerMinY && blockMinY < playerMaxY &&
        blockMaxZ > playerMinZ && blockMinZ < playerMaxZ) {
      console.log('🚫 Cannot place block inside player');
      return;
    }
    
    // Get selected item from inventory
    const selectedSlot = this.inventoryHUD.getSelectedSlot();
    const selectedItem = this.inventoryHUD.getItem(selectedSlot);
    
    if (!selectedItem || selectedItem.count <= 0) {
      console.log('🙌 No item selected to place');
      return;
    }
    
    // Attempt to place the block
    const success = this.chunkManager.placeBlock(placePos.x, placePos.y, placePos.z, selectedItem.blockType);
    
    if (success) {
      // Decrease item count in inventory
      this.inventoryHUD.removeItem(selectedSlot, 1);
      
      // Play punch animation (placing also uses arm swing)
      this.player.punch();
      
      // Play block place sound
      getSoundManager().playBlockPlace(selectedItem.blockType);
      
      console.log(`🧱 Placed ${BlockType[selectedItem.blockType]} at (${placePos.x}, ${placePos.y}, ${placePos.z})`);
    }
  }
  
  /**
   * Break the currently targeted block
   */
  /**
   * Update block breaking each frame (called from game loop)
   */
  private updateBlockBreaking(deltaTime: number): void {
    const isAttacking = this.isMouseDown || this.isGamepadAttacking || this.isMobileTouchBreaking;
    if (!isAttacking || !this.blockHighlight || !this.chunkManager || !this.player || !this.blockBreaking) {
      return;
    }
    
    // Get target block position - either from ongoing break or from highlight
    let blockPos: THREE.Vector3 | null = null;
    
    // If already breaking, use the stored target block (don't rely on highlight visibility)
    if (this.blockBreaking.isBreaking()) {
      blockPos = this.blockBreaking.getTargetBlock();
    }
    
    // If not breaking yet, try to start with the targeted block (crosshair is over a valid block)
    if (!blockPos && this.hasValidTarget) {
      blockPos = this.blockHighlight.getPosition();
    }
    
    // No valid target - can't break
    if (!blockPos) {
      this.blockBreaking.stopBreaking();
      return;
    }
    
    // Check reach distance
    const dx = blockPos.x + 0.5 - this.player.position.x;
    const dy = blockPos.y + 0.5 - (this.player.position.y + 0.9);
    const dz = blockPos.z + 0.5 - this.player.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance > PLAYER_REACH) {
      this.blockBreaking.stopBreaking();
      return;
    }
    
    // Get the block type we're trying to break
    const blockType = this.chunkManager.getBlockTypeAt(blockPos.x, blockPos.y, blockPos.z);
    if (blockType === null || blockType === BlockType.Air || blockType === BlockType.Water) {
      this.blockBreaking.stopBreaking();
      return;
    }
    
    // Trigger punch animation periodically while breaking
    if (!this.player.punching) {
      this.player.punch();
    }
    
    // Keep showing the square highlight while breaking
    this.blockHighlight.setVisible(true);
    
    // Track current stage for hit sound
    const previousStage = this.blockBreaking.getCurrentStage();
    
    // Progress breaking - returns true if block is broken
    const broken = this.blockBreaking.startBreaking(blockPos, blockType, deltaTime);
    
    // Play hit sound when breaking stage changes (not on every frame)
    const currentStage = this.blockBreaking.getCurrentStage();
    if (currentStage > previousStage && currentStage >= 0) {
      getSoundManager().playBlockHit(blockType);
    }
    
    if (broken) {
      // Block is broken! Remove it and spawn drops
      this.finishBreakingBlock(blockPos, blockType);
    }
  }
  
  /**
   * Finish breaking a block - remove it and spawn drops
   */
  private finishBreakingBlock(blockPos: THREE.Vector3, blockType: BlockType): void {
    if (!this.chunkManager || !this.droppedItemManager || !this.blockHighlight) return;
    
    // Play block break sound
    getSoundManager().playBlockBreak(blockType);
    
    // Remove the block
    this.chunkManager.removeBlock(blockPos.x, blockPos.y, blockPos.z);
    
    // Check if this is a leaf block - special drop logic
    const saplingType = LeavesToSaplingBlockType[blockType];
    
    if (saplingType !== undefined) {
      // Leaf block: chance to drop sapling, otherwise nothing
      const dropChance = SAPLING_DROP_CHANCE[blockType] || 0.05;
      
      if (Math.random() < dropChance) {
        // Lucky! Drop a sapling
        this.droppedItemManager.spawnItemsFromBlock(saplingType, blockPos, 1);
        console.log(`🌱 Leaves dropped a ${BlockType[saplingType]}!`);
      } else {
        console.log(`🍂 Leaves crumbled to nothing`);
      }
    } else {
      // Get the actual drop type (some blocks drop different items)
      const dropType = this.getBlockDropType(blockType);
      
      // Normal block: spawn dropped item
      this.droppedItemManager.spawnItemsFromBlock(dropType, blockPos, 1);
      console.log(`⛏️ Broke ${BlockType[blockType]} at (${blockPos.x}, ${blockPos.y}, ${blockPos.z})`);
    }
    
    // Hide highlight temporarily (will update on next mouse move)
    this.blockHighlight.setVisible(false);
  }
  
  /**
   * Get the item type that a block drops when broken
   * Some blocks drop different items (e.g., grass drops dirt)
   */
  private getBlockDropType(blockType: BlockType): BlockType {
    // Blocks that drop different items than themselves (Minecraft behavior)
    const blockDrops: Partial<Record<BlockType, BlockType>> = {
      // Grass blocks drop dirt
      [BlockType.Grass]: BlockType.Dirt,
      // Podzol drops dirt (in Minecraft, needs silk touch to get podzol)
      [BlockType.Podzol]: BlockType.Dirt,
      // Mycelium drops dirt (in Minecraft, needs silk touch to get mycelium)
      [BlockType.Mycelium]: BlockType.Dirt,
    };
    
    return blockDrops[blockType] ?? blockType;
  }
  
  /**
   * Legacy break method - kept for instant break with tools (future)
   */
  private breakTargetedBlock(): void {
    // Now handled by updateBlockBreaking - this is kept for future instant-break tools
  }

  /**
   * Update camera zoom
   */
  private updateCameraZoom(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -this.zoom * aspect;
    this.camera.right = this.zoom * aspect;
    this.camera.top = this.zoom;
    this.camera.bottom = -this.zoom;
    this.camera.updateProjectionMatrix();
    
    // Update chunk manager with zoom for LOD calculations
    if (this.chunkManager) {
      this.chunkManager.setZoom(this.zoom);
    }
  }

  /**
   * Update block highlight based on mouse position
   * Note: The highlight is only shown while breaking a block, not during normal hover
   */
  private updateBlockHighlight(mouseX: number, mouseY: number): void {
    if (!this.blockHighlight || !this.chunkManager) return;
    
    // Convert mouse to normalized device coordinates
    const ndcX = (mouseX / window.innerWidth) * 2 - 1;
    const ndcY = -(mouseY / window.innerHeight) * 2 + 1;
    
    // Raycast to find block
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    
    // Get all chunk groups for raycasting (includes terrain and tree blocks)
    const chunkGroups: THREE.Object3D[] = [];
    this.scene.children.forEach((child) => {
      // Only include chunk groups (named "chunk_X,Z")
      if (child.name.startsWith('chunk_')) {
        chunkGroups.push(child);
      }
    });
    
    // Raycast with recursive search through chunk children (true = recursive)
    const intersects = raycaster.intersectObjects(chunkGroups, true);
    
    if (intersects.length > 0) {
      const hit = intersects[0];
      
      // Get the hit point and face normal
      const point = hit.point.clone();
      const normal = hit.face?.normal;
      
      // Determine which face was hit
      let face: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back' = 'top';
      
      if (normal) {
        // Transform normal from object space to world space
        const worldNormal = normal.clone().transformDirection(hit.object.matrixWorld);
        
        // Determine face from normal
        face = getFaceFromNormal(worldNormal);
        
        // Move 0.1 units into the block for better detection
        point.sub(worldNormal.multiplyScalar(0.1));
      }
      
      // Round to nearest integer since blocks are centered at integer coordinates
      const blockPos = new THREE.Vector3(
        Math.round(point.x),
        Math.round(point.y),
        Math.round(point.z)
      );
      
      // Position highlight at block center and set the face (always update position for targeting)
      this.blockHighlight.setPosition(blockPos.x, blockPos.y, blockPos.z, face);
      
      // Set highlight color based on block type (black for light blocks, white for dark)
      const blockType = this.chunkManager.getBlockTypeAt(blockPos.x, blockPos.y, blockPos.z);
      this.blockHighlight.setColorForBlock(blockType);
      
      // Mark that we have a valid target (for block breaking)
      this.hasValidTarget = true;
      
      // Show the square highlight when hovering over a block
      // (both crosshair "+" and square highlight are visible)
      this.blockHighlight.setVisible(true);
    } else {
      this.hasValidTarget = false;
      this.blockHighlight.setVisible(false);
    }
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    
    this.camera.left = -this.zoom * aspect;
    this.camera.right = this.zoom * aspect;
    this.camera.top = this.zoom;
    this.camera.bottom = -this.zoom;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Main animation loop
   */
  private animate = (): void => {
    requestAnimationFrame(this.animate);
    
    if (!this.isInitialized) return;
    
    const deltaTime = this.clock.getDelta();
    
    // Update gamepad input
    const gamepad = getGamepadManager();
    gamepad.update(deltaTime);
    
    // Update crosshair position from right stick (smooth velocity-based movement)
    if (!this.isPaused && !this.creativeInventory.isInventoryVisible()) {
      const crosshairInput = gamepad.getCrosshairVector();
      
      // Update crosshair with smooth movement (handles acceleration/deceleration)
      this.crosshair.updateGamepad(crosshairInput.x, crosshairInput.y, deltaTime);
      
      // Continuous zoom with triggers (L2 = zoom out, R2 = zoom in)
      const zoomSpeed = 8 * deltaTime; // Zoom units per second
      if (gamepad.isActionPressed(GameAction.ZoomIn)) {
        this.zoom = Math.max(5, this.zoom - zoomSpeed);
        this.updateCameraZoom();
      }
      if (gamepad.isActionPressed(GameAction.ZoomOut)) {
        this.zoom = Math.min(26, this.zoom + zoomSpeed);
        this.updateCameraZoom();
      }
    }
    
    // Handle gamepad attack state (continuous breaking)
    if (gamepad.isActionPressed(GameAction.Attack) && !this.isPaused) {
      this.isGamepadAttacking = true;
    } else if (!gamepad.isActionPressed(GameAction.Attack)) {
      this.isGamepadAttacking = false;
    }
    
    // Skip game updates when paused, but still render
    if (!this.isPaused) {
      // Update player movement
      this.updatePlayerMovement(deltaTime);
      
      // Update camera to follow player
      this.updateCamera();
      
      // Update block highlight to reflect camera movement
      // (when player moves, crosshair now points to different world position)
      const crosshairPos = this.crosshair.getPosition();
      this.updateBlockHighlight(crosshairPos.x, crosshairPos.y);
      
      // Update chunks around player
      if (this.chunkManager && this.player) {
        this.chunkManager.update(
          this.player.position.x,
          this.player.position.z
        );
        
        // Update player position for falling block collision detection
        this.chunkManager.setPlayerPosition(this.player.position);
        
        // Update falling blocks (sand/gravel gravity)
        this.chunkManager.updateFallingBlocks(deltaTime);
      }
      
      // Update dropped items
      if (this.droppedItemManager && this.player) {
        this.droppedItemManager.update(deltaTime, this.player.position);
      }
      
      // Update block breaking (continuous hold to break)
      this.updateBlockBreaking(deltaTime);
    }
    
    // Update debug UI (even when paused, for FPS display)
    this.updateDebugUI(deltaTime);
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Update player movement based on input
   * 
   * Movement physics are delegated to PlayerPhysics component (decoupled).
   * This method handles input -> physics -> player state updates.
   */
  private updatePlayerMovement(deltaTime: number): void {
    if (!this.player || !this.chunkManager || !this.playerPhysics) return;
    
    // === INPUT HANDLING ===
    const keys = (this as any).keys as Set<string>;
    const gamepad = getGamepadManager();
    const speed = 10; // Blocks per second
    
    let moveX = 0;
    let moveZ = 0;
    
    // WASD movement (adjusted for isometric view)
    if (keys.has('KeyW') || keys.has('ArrowUp')) { moveX -= 1; moveZ -= 1; }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { moveX += 1; moveZ += 1; }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { moveX -= 1; moveZ += 1; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { moveX += 1; moveZ -= 1; }
    
    // Gamepad movement (isometric: forward = -X/-Z, right = +X/-Z)
    const gamepadMove = gamepad.getMovementVector();
    if (Math.abs(gamepadMove.x) > 0.01 || Math.abs(gamepadMove.y) > 0.01) {
      moveX = -gamepadMove.y + gamepadMove.x;
      moveZ = -gamepadMove.y - gamepadMove.x;
    }
    
    // Mobile analog stick movement (isometric: same as gamepad)
    if (Math.abs(this.mobileMovement.x) > 0.01 || Math.abs(this.mobileMovement.y) > 0.01) {
      moveX = -this.mobileMovement.y + this.mobileMovement.x;
      moveZ = -this.mobileMovement.y - this.mobileMovement.x;
    }
    
    // Jump with Space (or swim up when in water)
    if (keys.has('Space')) {
      if (this.player.swimming) {
        // Swim up when in water - raise Y position toward water surface
        const swimUpSpeed = 3.0; // Blocks per second
        const waterSurfaceY = this.playerPhysics.calculateTargetY(
          this.player.position.x,
          this.player.position.z,
          this.player.position.y,
          true // isSwimming
        );
        // Move toward water surface (but don't go above it)
        const newY = this.player.position.y + swimUpSpeed * deltaTime;
        this.player.position.y = Math.min(newY, waterSurfaceY);
      } else {
        this.player.jump();
      }
    }
    
    // Crouch handling (can't crouch while swimming)
    if (!this.player.swimming) {
      const keyboardCrouching = keys.has('KeyC');
      if (keyboardCrouching || !this.isGamepadCrouching) {
        this.player.setCrouching(keyboardCrouching || this.isGamepadCrouching);
      }
    } else {
      this.isGamepadCrouching = false;
    }
    
    // === PHYSICS STATE DETECTION (delegated to PlayerPhysics) ===
    
    // Sync water swim Y offset with physics component
    this.playerPhysics.setWaterSwimYOffset(this.waterSwimYOffset);
    
    // Check swimming state using physics component
    const isActuallyInWater = this.playerPhysics.isInWater(
      this.player.position.x,
      this.player.position.z,
      this.player.position.y
    );
    this.player.setSwimming(isActuallyInWater);
    
    // Update block type for footstep sounds
    const blockAtFeet = this.playerPhysics.getBlockAtFeet(
      this.player.position.x,
      this.player.position.z
    );
    if (blockAtFeet !== null && blockAtFeet !== BlockType.Air) {
      this.player.setCurrentBlockType(blockAtFeet);
    }
    
    // === FALL DETECTION (delegated to PlayerPhysics) ===
    if (!this.player.jumping && !this.player.swimming) {
      const canStand = this.playerPhysics.canStand(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );
      if (!canStand) {
        this.player.fall();
      }
    }
    
    // === SWIMMING Y ADJUSTMENT ===
    if (this.player.swimming && !this.player.jumping) {
      const expectedY = this.playerPhysics.calculateTargetY(
        this.player.position.x,
        this.player.position.z,
        this.player.position.y,
        true
      );
      this.player.setY(expectedY);
    }
    
    // === HORIZONTAL MOVEMENT (delegated to PlayerPhysics) ===
    if (moveX !== 0 || moveZ !== 0) {
      // Normalize diagonal movement and apply speed
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const effectiveSpeed = speed * this.player.getSpeedMultiplier();
      moveX = (moveX / length) * effectiveSpeed * deltaTime;
      moveZ = (moveZ / length) * effectiveSpeed * deltaTime;
      
      // Delegate movement to physics component - handles collision, step-up, arcs
      const result = this.playerPhysics.tryMove(
        {
          position: this.player.position,
          isJumping: this.player.jumping || this.player.isInAir(),
          isSwimming: this.player.swimming,
          isCrouching: this.player.crouching,
          jumpVelocity: this.player.getJumpVelocity(),
        },
        moveX,
        moveZ
      );
      
      if (result.moved) {
        // Apply the movement
        this.player.move(
          result.newX - this.player.position.x,
          result.newZ - this.player.position.z
        );
        
        // Handle Y position based on state
        if (this.player.jumping || this.player.isInAir()) {
          this.player.updateTerrainY(result.newY);
        } else if (result.shouldFall) {
          this.player.fall();
          this.player.updateTerrainY(result.newY);
        } else {
          this.player.setY(result.newY);
        }
      }
    }
    
    // === JUMP LANDING (edge-based) ===
    if (this.player.jumping) {
      // Get terrain height considering all hitbox corners (edge-based landing)
      // Pass player Y to avoid detecting arcs/overhangs above the player
      const finalStandingY = this.chunkManager.getStandingHeightAt(
        this.player.position.x,
        this.player.position.z,
        this.player.position.y
      );
      
      // Check for water at center for proper landing
      const centerTerrainHeight = this.chunkManager.getHeightAt(
        this.player.position.x,
        this.player.position.z
      );
      const finalBlockType = this.chunkManager.getBlockAt(
        Math.floor(this.player.position.x),
        Math.floor(centerTerrainHeight),
        Math.floor(this.player.position.z)
      );
      const finalIsWater = finalBlockType === BlockType.Water;
      
      const finalTerrainY = finalIsWater 
        ? Math.max(finalStandingY, centerTerrainHeight + WATER_HEIGHT + 0.5)
        : finalStandingY;
      this.player.updateTerrainY(finalTerrainY);
    }
    
    // === PLAYER UPDATE (animation, state machine) ===
    this.player.update(deltaTime);
    
    // === CEILING COLLISION ===
    if (this.player.jumping && this.player.getJumpVelocity() > 0) {
      const ceilingCheck = this.playerPhysics.checkCeilingCollision(
        this.player.position.x,
        this.player.position.y,
        this.player.position.z
      );
      
      if (ceilingCheck.hit) {
        this.player.hitCeiling(ceilingCheck.maxY);
      }
    }
  }

  /**
   * Update camera to follow player
   */
  private updateCamera(): void {
    if (!this.player) return;
    
    // Camera follows player with isometric offset
    const d = this.cameraDistance;
    this.camera.position.set(
      this.player.position.x + d,
      this.player.position.y + d,
      this.player.position.z + d
    );
    this.camera.lookAt(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );
    
    // Update shadow camera to follow player (keeps shadows in visible area)
    const sun = (this as any).sunLight as THREE.DirectionalLight;
    const shadowOffset = (this as any).shadowOffset || { x: 15, y: 200, z: 160 };
    if (sun) {
      // STABLE SHADOW MAPPING: Snap shadow camera to texel boundaries
      // This prevents shadow "swimming" when the player moves
      const shadowMapSize = sun.shadow.mapSize.width; // 2048
      const shadowCameraSize = 60; // From sun.shadow.camera.right
      const texelSize = (shadowCameraSize * 2) / shadowMapSize; // World units per shadow texel
      
      // Snap target position to texel grid (round instead of floor for better centering)
      const snappedX = Math.round(this.player.position.x / texelSize) * texelSize;
      const snappedZ = Math.round(this.player.position.z / texelSize) * texelSize;
      
      // Position sun relative to snapped position
      sun.position.set(
        snappedX + shadowOffset.x,
        this.player.position.y + shadowOffset.y,
        snappedZ + shadowOffset.z
      );
      // Point shadow camera at snapped position
      sun.target.position.set(
        snappedX,
        this.player.position.y,
        snappedZ
      );
    }
  }

  /**
   * Update debug UI
   */
  private updateDebugUI(deltaTime: number): void {
    if (!this.player || !this.generator) return;
    
    const biome = this.generator.getBiomeAt(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z)
    );
    
    // Calculate FPS from delta time (avoid division by zero)
    const fps = deltaTime > 0 ? Math.round(1 / deltaTime) : 60;
    
    // Get block below player
    let blockBelow: string | null = null;
    if (this.chunkManager) {
      const belowY = Math.floor(this.player.position.y) - 1;
      const blockType = this.chunkManager.getBlockAt(
        Math.floor(this.player.position.x),
        belowY,
        Math.floor(this.player.position.z)
      );
      if (blockType !== null) {
        blockBelow = BlockType[blockType];
      }
    }
    
    // Get targeted block
    let targetedBlock: string | null = null;
    if (this.blockHighlight?.isVisible() && this.chunkManager) {
      const pos = this.blockHighlight.getPosition();
      const blockType = this.chunkManager.getBlockAt(
        Math.floor(pos.x),
        Math.floor(pos.y),
        Math.floor(pos.z)
      );
      if (blockType !== null) {
        targetedBlock = BlockType[blockType];
      }
    }
    
    // Get renderer stats
    const renderInfo = this.renderer.info.render;
    
    this.debugUI.update({
      fps,
      playerX: this.player.position.x,
      playerY: this.player.position.y,
      playerZ: this.player.position.z,
      chunks: this.chunkManager?.getChunkCount() || 0,
      biome: this.generator.getBiomeName(biome),
      seed: this.seed,
      zoom: this.zoom,
      playerState: this.player.getStateName(),
      triangles: renderInfo.triangles,
      drawCalls: renderInfo.calls,
      blockBelow,
      targetedBlock,
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.renderer.dispose();
    this.chunkManager?.destroy();
    this.player?.destroy();
    this.blockHighlight?.destroy();
    this.droppedItemManager?.destroy();
    this.blockBreaking?.destroy();
    this.crosshair.destroy();
    this.debugUI.destroy();
    this.shaderDebugUI.destroy();
    this.pauseMenu.destroy();
    this.creativeInventory.destroy();
    this.mobileControls?.destroy();
    getMusicManager().destroy();
  }
}

