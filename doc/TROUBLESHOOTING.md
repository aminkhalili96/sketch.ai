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

### 3D Model Shows Wrong Object Type

**Cause:** Vision analysis misidentified the object.

**Solutions:**
1. Re-analyze the sketch
2. Add description clarifying the object type
3. Use clearer sketch with distinct features

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
