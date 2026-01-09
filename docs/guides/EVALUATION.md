# Evaluation & Benchmarks

This project includes a lightweight evaluation harness to validate structured outputs and object-kind accuracy. It is designed to be runnable on either OpenAI or local Ollama models.

## What We Measure
- **Scene JSON validity**: model output parses and validates
- **Object-kind accuracy**: enclosure vs object (toy/character)
- **Element count**: minimum parts for plausibility
- **Critique score**: critic’s final score when available
- **Latency**: per case, end-to-end

## Dataset
`doc/eval/benchmarks.json` contains curated prompts covering enclosures and organic objects.

## How To Run
1. Start the app:
   - `npm run dev`
2. Run the harness:
   - `node scripts/eval-harness.mjs --base-url http://localhost:3000`
   - or `npm run eval`
   - Optional BOM check: `--bom`

Results are written to:
- `doc/eval/results.json`
- `doc/eval/results.md`

## Notes
- For offline evaluation, set `USE_OFFLINE_MODEL=true` and confirm Ollama is running.
- For faster iterations, use `OLLAMA_TEXT_MODEL=qwen2.5:7b`.
