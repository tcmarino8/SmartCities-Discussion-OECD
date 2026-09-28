# OECD Smart Cities Knowledge Graph

Interactive constellation graph with node-centered discussion orbs and a Neo4j graph backend.

## What Is Implemented

- Cursor-driven network navigation:
  - Drag canvas to pan.
  - Mouse wheel to zoom in and out.
  - Click a node to zoom/focus on that module.
- Circular node popup (orb) with color-separated content:
  - Report facts in aqua text.
  - Community comments in cool blue text cards.
- Neo4j-backed graph API for typed nodes and named links:
  - Node types: `Person`, `Comment`, `ReportText`, `Module`
  - Relationship types: `FOLLOWS_PERSON`, `FOLLOWS_MODULE`, `POSTED_COMMENT`, `BELONGS_TO_MODULE`, `SOURCE_TEXT_BELONGS_TO_MODULE`, `COMMENT_REFERENCES_SOURCE_TEXT`, `PERSON_MENTIONS_MODULE`
- Local fallback:
  - Frontend keeps comments in localStorage if API is unavailable.

## Project Files

- `index.html` - Page structure, canvas, and circular module orb UI.
- `style.css` - Ethereal visual styling and orb layout.
- `app.js` - Graph physics, pan/zoom controls, module focus, and API integration.
- `server.js` - Express + Neo4j backend and graph endpoints.
- `.env.example` - Environment variable template.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set your Neo4j values:

```env
PORT=3000
NEO4J_URI=neo4j+s://<your-aura-host>.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<your-neo4j-password-or-api-key>
NEO4J_DATABASE=neo4j
```

3. Start the app:

```bash
npm start
```

4. Open:

- `http://localhost:3000`

## API Endpoints

### Health

- `GET /api/health`

### Schema Init

- `POST /api/schema/init`
- Creates uniqueness constraints for `Person`, `Comment`, `Module`, `ReportText`.

### Generic Node Creation / Upsert

- `POST /api/nodes`

## Stadia Maps Background (Istanbul)

The graph now supports a Stadia Maps tile background centered on Istanbul.

1. Open app.js.
2. Find this constant near the top:

```js
const STADIA_MAPS_API_KEY = "YOUR_STADIA_MAPS_API_KEY";
```

3. Replace `YOUR_STADIA_MAPS_API_KEY` with your real key.
4. Restart the app if it is already running.

The map is rendered as a non-interactive visual backdrop behind the constellation canvas.

Body example:

```json
{
  "type": "Module",
  "id": "governance",
  "properties": {
    "name": "Urban Governance",
    "category": "Institutions"
  }
}
```

### Generic Link Creation / Upsert

- `POST /api/links`

Body example:

```json
{
  "fromType": "Person",
  "fromId": "person-alex",
  "toType": "Module",
  "toId": "governance",
  "relationType": "FOLLOWS_MODULE",
  "properties": {
    "source": "ui"
  }
}
```

### Follow Endpoint

- `POST /api/follows`

Body examples:

```json
{
  "followerPersonId": "person-alex",
  "targetType": "Person",
  "targetId": "person-sam"
}
```

```json
{
  "followerPersonId": "person-alex",
  "targetType": "Module",
  "targetId": "mobility"
}
```

### Create Comment and Required Links

- `POST /api/comments`
- Creates or updates:
  - `Person`
  - `Comment`
  - `Module`
- Creates relationships:
  - `(Person)-[:POSTED_COMMENT]->(Comment)`
  - `(Comment)-[:BELONGS_TO_MODULE]->(Module)`
  - Optional: `(Comment)-[:COMMENT_REFERENCES_SOURCE_TEXT]->(ReportText)`

Body example:

```json
{
  "personName": "Alex",
  "moduleId": "governance",
  "body": "Can we compare participatory budgeting outcomes across districts?",
  "kind": "Research Idea"
}
```

### Module Discussion Query

- `GET /api/modules/:moduleId/discussion`
- Returns module, related report text, and comments with author names.

### Seed Modules and Report Facts

- `POST /api/seed/modules`
- Accepts module array and creates:
  - `Module` nodes
  - `ReportText` nodes
  - `SOURCE_TEXT_BELONGS_TO_MODULE` links

### Whole Graph Snapshot

- `GET /api/graph`

## Recommended First Run Sequence

1. `POST /api/schema/init`
2. `POST /api/seed/modules` with the module array in `app.js`
3. Open UI and begin posting comments.

## Note on Report Facts

The current fact bullets are seeded from high-level report themes. You can replace them with exact excerpt-level facts from your PDF and optionally attach citation metadata in `ReportText` node properties.