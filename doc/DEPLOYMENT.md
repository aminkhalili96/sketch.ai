# Deployment Guide

## Prerequisites

- Node.js 18+
- OpenAI API key
- (Optional) Tavily API key for pricing

## Environment Variables

```bash
OPENAI_API_KEY=sk-...        # Required
TAVILY_API_KEY=tvly-...      # Optional, for component pricing
```

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
docker build -t sketch-ai .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... sketch-ai
```

## Vercel Deployment

1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Environment Configuration

### Development
```
NODE_ENV=development
```

### Production
```
NODE_ENV=production
```

## Monitoring

### Logs
- Server logs: Check terminal/container logs
- Agent logs: Prefixed with `[Agent]`

### Health Check
```
GET /api/health
```
(Add this endpoint if needed)

## Scaling Considerations

1. **API Rate Limits**: OpenAI has rate limits, consider caching
2. **Memory**: 3D rendering is client-side, low server memory
3. **CDN**: Static assets can be cached
