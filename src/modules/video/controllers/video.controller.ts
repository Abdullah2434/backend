/**
 * Main video controller file - re-exports all controllers for backward compatibility
 * This file maintains the same API surface while the actual implementations
 * are split across multiple focused controller files for better organization.
 *
 * File Structure:
 * - videoGallery.controller.ts - Gallery operations
 * - videoWorkflow.controller.ts - Workflow tracking and management
 * - videoDownload.controller.ts - Download and status operations
 * - videoDeletion.controller.ts - Video deletion operations
 * - videoCreation.controller.ts - Video creation and generation
 * - videoAssets.controller.ts - Avatars and voices management
 * - videoTopics.controller.ts - Topic management
 * - videoNotes.controller.ts - Video notes management
 */

// Re-export all controllers from separate files
export * from "./videoGallery.controller";
export * from "./videoWorkflow.controller";
export * from "./videoDownload.controller";
export * from "./videoDeletion.controller";
export * from "./videoCreation.controller";
export * from "./videoAssets.controller";
export * from "./videoTopics.controller";
export * from "./videoNotes.controller";
