# Troubleshooting

## Common Issues

### "No response from AI"

**Cause:** OpenAI API rate limiting or timeout.

**Solutions:**
1. Check your API key is valid
2. Check OpenAI status page
3. Wait a few minutes and retry
4. Reduce concurrent requests

---

### "AI refused to answer"

**Cause:** Vision model returned an empty/refusal response.

**Solutions:**
1. Add a short text description (the system will fall back to description-only analysis)
2. Re-upload a clearer, higher-contrast sketch
3. Avoid overly large or blurry images

---

### 3D Model Shows Wrong Object Type

**Cause:** Vision analysis misidentified the object.

**Solutions:**
1. Re-analyze the sketch
2. Add description clarifying the object type (e.g., "teddy bear") in addition to color notes
3. Use clearer sketch with distinct features

**Note:** Short color-only notes (e.g., "brown") are treated as user notes. If the model still flips to a box, re-run analysis or include the object type explicitly.

---

### Missing Body Parts in 3D

**Cause:** LLM generated incomplete structure.

**Solutions:**
1. Click "Generate All" again to regenerate
2. The Critic+Refiner loop should catch and fix
3. Check console for agent logs

---

### Colors Not Matching Sketch

**Cause:** LLM didn't extract colors correctly.

**Solutions:**
1. Ensure sketch has clear, distinct colors
2. Add description mentioning colors: "brown teddy bear"
3. Colors should be preserved if LLM generates valid hex

---

### BOM Looks Like Plain Text

**Cause:** LLM output includes prose or malformed Markdown tables.

**Solutions:**
1. Regenerate the BOM (it should now return a strict table-only output)
2. Ensure the prompt asks for a specific object type plus requirements
3. Check the Link column uses `[Link](https://...)` format

---

### OpenSCAD Compilation Failed

**Cause:** OpenSCAD not installed or code has errors.

**Solutions:**
1. Install OpenSCAD: https://openscad.org/downloads.html
2. Use "Download .scad" to manually compile
3. Check console for specific error

---

### Tests Failing

**Common causes:**
1. Missing mock for new OpenAI call
2. Changed output format
3. Type mismatch

**Debug steps:**
```bash
npm test -- --reporter=verbose
```

---

### Slow Generation

**Cause:** Multiple sequential LLM calls.

**Current workaround:** Be patient (~10-15 seconds)

**Future:** Parallel agent calls, caching

---

## Getting Help

1. Check this troubleshooting guide
2. Review console logs in browser DevTools
3. Check server logs in terminal
4. Open an issue on GitHub
