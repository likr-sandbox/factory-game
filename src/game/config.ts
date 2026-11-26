// Phaser game configuration
import * as Phaser from "phaser";
import { FactoryScene } from "./FactoryScene";

/**
 * Create Phaser game configuration
 * @param parent - Parent container element or ID (defaults to "game-container")
 * @param sceneInstance - Optional scene instance to use instead of FactoryScene class
 * @returns Phaser GameConfig object
 */
export function createPhaserConfig(
  parent?: string | HTMLElement,
  sceneInstance?: FactoryScene
): Phaser.Types.Core.GameConfig {
  // Safely get window dimensions with fallbacks for non-browser environments
  const width = typeof window !== "undefined" ? window.innerWidth : 800;
  const height = typeof window !== "undefined" ? window.innerHeight : 600;

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parent ?? "game-container",
    width,
    height,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: "#1a1a2e",
    scene: sceneInstance ?? [FactoryScene],
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
  };

  return config;
}
