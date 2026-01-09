# API Reference

## Base URL

```
http://localhost:3000/api
```

---

## Endpoints

### POST /api/analyze

Analyzes a sketch image to extract components and features.
If vision analysis fails, the endpoint falls back to description-only analysis.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "description": "Optional description"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "identifiedComponents": ["microcontroller", "sensor"],
    "suggestedFeatures": ["WiFi", "battery power"],
    "complexityScore": 5,
    "complexity": "moderate",
    "questions": ["What sensor type?"],
    "summary": "IoT sensor device"
  }
}
```

---

### POST /api/generate

Generates outputs (3D model, BOM, firmware, etc.) from project description.

**Request:**
```json
{
  "projectDescription": "Smart home sensor",
  "analysisContext": { /* optional AnalysisResult */ },
  "outputTypes": ["scene-json", "bom", "openscad"],
  "sketchImage": "data:image/jpeg;base64,..." // For vision-to-3D
}
```

**Output Types:**
- `scene-json` - 3D scene in JSON format
- `openscad` - OpenSCAD code
- `bom` - Bill of Materials (table-only Markdown)
- `assembly` - Assembly instructions
- `firmware` - Arduino/ESP code
- `schematic` - Circuit description

**Response:**
```json
{
  "success": true,
  "outputs": {
    "scene-json": "[{\"type\":\"box\",...}]",
    "bom": "| Item | Part Number | ..."
  },
  "metadata": {
    "estimatedCost": 45,
    "complexity": "moderate",
    "buildTime": "3 hours"
  }
}
```

---

### POST /api/generate/stream

Streams generation status and outputs as newline-delimited JSON (NDJSON).

**Request:** Same as `/api/generate`

**Streaming Response (NDJSON):**
```json
{"type":"status","message":"Generating BOM...","outputType":"bom"}
{"type":"output","outputType":"bom","content":"| Item | ..."}
{"type":"metadata","metadata":{"estimatedCost":45,"complexity":"moderate","buildTime":"3 hours"}}
{"type":"done"}
```

---

### POST /api/chat

Conversational refinement of the project.

**Request:**
```json
{
  "message": "Make it waterproof",
  "history": [
    { "id": "1", "role": "user", "content": "...", "timestamp": "..." }
  ],
  "projectContext": {
    "description": "Outdoor sensor",
    "analysis": { /* AnalysisResult */ },
    "outputs": { /* current outputs */ }
  }
}
```

**Response:**
```json
{
  "success": true,
  "reply": "To make it waterproof, I recommend...",
  "suggestedActions": ["Regenerate 3D Model", "Update Bill of Materials"]
}
```

---

### POST /api/chat/stream

Streams chat responses as NDJSON.

**Request:** Same as `/api/chat`

**Streaming Response (NDJSON):**
```json
{"type":"delta","text":"..."}
{"type":"delta","text":"..."}
{"type":"done"}
```

---

### POST /api/export

Exports project as a ZIP file.

**Request:**
```json
{
  "projectName": "my-project",
  "outputs": { /* ProjectOutputs */ },
  "metadata": { /* ProjectMetadata */ }
}
```

**Response:**
- Content-Type: `application/zip`
- Binary ZIP file containing all outputs

---

### POST /api/compile-3d

Compiles OpenSCAD code to STL.

**Request:**
```json
{
  "code": "cube([10, 10, 10]);",
  "format": "stl"
}
```

**Response:**
```json
{
  "success": true,
  "stl": "base64-encoded-stl-data"
}
```

---

### POST /api/build-guide

Generates a single Markdown build guide that combines BOM, assembly, and schematic.

**Request:**
```json
{
  "projectName": "my-project",
  "outputs": { /* ProjectOutputs */ },
  "metadata": { /* optional ProjectMetadata */ }
}
```

**Response:**
- Markdown file download (`text/markdown`) named `project-build-guide.md`

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (validation error)
- `500` - Server error
