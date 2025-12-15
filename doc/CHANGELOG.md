# Changelog

All notable changes to Sketch.ai are documented here.

## [Unreleased]

### Added
- Multi-agent 3D generation pipeline (5 agents)
- Vision-to-3D: Pass sketch image directly to generation
- Critic + Refiner self-correction loop
- Comprehensive documentation in `/doc` folder

### Changed
- Removed hardcoded teddy bear fallbacks
- Colors now preserved from LLM instead of forced white/grey
- Scene generation uses orchestrator instead of single prompt

### Fixed
- PCB images no longer generate teddy bears
- 3D models now include all body parts (eyes, ears, etc.)
- Colors match sketch input

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
