# Changelog

All notable changes to Sketch.ai are documented here.

## [Unreleased]

### Added
- Multi-agent 3D generation pipeline (5 agents)
- Vision-to-3D: Pass sketch image directly to generation
- Critic + Refiner self-correction loop
- Comprehensive documentation in `/doc` folder
- Product overview cards for BOM, assembly, and schematic
- Build guide download (combined BOM + assembly + schematic)
- Exploded-view toggle for 3D previews
- Version stamp in footer (version + last updated)
- Output version history with restore
- Streaming chat responses
- Streaming generation status (NDJSON) for outputs

### Changed
- Removed hardcoded teddy bear fallbacks
- Colors now preserved from LLM instead of forced white/grey
- Scene generation uses orchestrator instead of single prompt
- 3D generation now merges analysis summaries with user notes to prevent color-only overrides
- BOM generation now enforces table-only output with production-grade columns

### Fixed
- PCB images no longer generate teddy bears
- 3D models now include all body parts (eyes, ears, etc.)
- Colors match sketch input
- Organic objects no longer regress to enclosure boxes on regeneration
- BOM rendering now parses and displays structured tables
- Analyze endpoint now falls back to description-only analysis when vision refuses

---

## [0.2.0] - 2024-12-15

### Added
- Real-time component pricing via Tavily API
- Scene JSON output for 3D preview
- React Three Fiber 3D renderer
- Reflection system for quality validation

### Changed
- Parallel generation for non-3D outputs
- Improved OpenSCAD prompts

---

## [0.1.0] - 2024-12-14

### Added
- Initial project setup with Next.js 14
- Sketch upload and analysis with GPT-4 Vision
- Output generation: BOM, Assembly, Firmware, Schematic, OpenSCAD
- Chat interface for refinement
- Export to ZIP
- Zustand state management with persistence
- Comprehensive test suite (36 tests)
