const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");

const PDF_FILE = "AI_for_advancing_smart_cities.pdf";
const OUTPUT_FILE = path.join("data", "oecd-geo-database.json");

const PLACE_CATALOG = [
  {
    id: "barcelona",
    name: "Barcelona",
    country: "Spain",
    lat: 41.3874,
    lng: 2.1686,
    aliases: ["Barcelona"],
    resources: [
      { label: "Ajuntament de Barcelona - Smart City", url: "https://ajuntament.barcelona.cat/digital/en", type: "city" },
      { label: "OECD Publications", url: "https://www.oecd.org/publications/", type: "oecd" }
    ]
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    lat: 52.3676,
    lng: 4.9041,
    aliases: ["Amsterdam"],
    resources: [
      { label: "Amsterdam Smart City", url: "https://amsterdamsmartcity.com/", type: "city" },
      { label: "OECD Urban Policy", url: "https://www.oecd.org/en/topics/urban-rural-and-regional-development.html", type: "oecd" }
    ]
  },
  {
    id: "helsinki",
    name: "Helsinki",
    country: "Finland",
    lat: 60.1699,
    lng: 24.9384,
    aliases: ["Helsinki"],
    resources: [
      { label: "City of Helsinki Open Data", url: "https://www.hel.fi/en/decision-making/information/open-data", type: "city" },
      { label: "OECD AI Policy Observatory", url: "https://oecd.ai/", type: "oecd" }
    ]
  },
  {
    id: "seoul",
    name: "Seoul",
    country: "South Korea",
    lat: 37.5665,
    lng: 126.978,
    aliases: ["Seoul"],
    resources: [
      { label: "Seoul Smart City", url: "https://smartcity.seoul.go.kr/", type: "city" },
      { label: "OECD Korea", url: "https://www.oecd.org/korea/", type: "oecd" }
    ]
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    aliases: ["Singapore"],
    resources: [
      { label: "Smart Nation Singapore", url: "https://www.smartnation.gov.sg/", type: "city" },
      { label: "OECD Southeast Asia", url: "https://www.oecd.org/southeast-asia/", type: "oecd" }
    ]
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    lat: 51.5074,
    lng: -0.1278,
    aliases: ["London"],
    resources: [
      { label: "London Datastore", url: "https://data.london.gov.uk/", type: "city" },
      { label: "OECD United Kingdom", url: "https://www.oecd.org/unitedkingdom/", type: "oecd" }
    ]
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    lat: 48.8566,
    lng: 2.3522,
    aliases: ["Paris"],
    resources: [
      { label: "Paris Open Data", url: "https://opendata.paris.fr/", type: "city" },
      { label: "OECD France", url: "https://www.oecd.org/france/", type: "oecd" }
    ]
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    aliases: ["Tokyo"],
    resources: [
      { label: "Tokyo Open Data", url: "https://portal.data.metro.tokyo.lg.jp/", type: "city" },
      { label: "OECD Japan", url: "https://www.oecd.org/japan/", type: "oecd" }
    ]
  },
  {
    id: "new-york-city",
    name: "New York City",
    country: "United States",
    lat: 40.7128,
    lng: -74.006,
    aliases: ["New York", "New York City", "NYC"],
    resources: [
      { label: "NYC Open Data", url: "https://opendata.cityofnewyork.us/", type: "city" },
      { label: "OECD United States", url: "https://www.oecd.org/unitedstates/", type: "oecd" }
    ]
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    country: "United States",
    lat: 34.0522,
    lng: -118.2437,
    aliases: ["Los Angeles"],
    resources: [
      { label: "Los Angeles Open Data", url: "https://data.lacity.org/", type: "city" },
      { label: "OECD Open Government Data", url: "https://www.oecd.org/gov/digital-government/open-government-data.htm", type: "oecd" }
    ]
  },
  {
    id: "copenhagen",
    name: "Copenhagen",
    country: "Denmark",
    lat: 55.6761,
    lng: 12.5683,
    aliases: ["Copenhagen"],
    resources: [
      { label: "Copenhagen Solutions Lab", url: "https://cphsolutionslab.dk/", type: "city" },
      { label: "OECD Denmark", url: "https://www.oecd.org/denmark/", type: "oecd" }
    ]
  },
  {
    id: "vienna",
    name: "Vienna",
    country: "Austria",
    lat: 48.2082,
    lng: 16.3738,
    aliases: ["Vienna"],
    resources: [
      { label: "DigitalCity.Wien", url: "https://digitalcity.wien/", type: "city" },
      { label: "OECD Austria", url: "https://www.oecd.org/austria/", type: "oecd" }
    ]
  },
  {
    id: "zurich",
    name: "Zurich",
    country: "Switzerland",
    lat: 47.3769,
    lng: 8.5417,
    aliases: ["Zurich"],
    resources: [
      { label: "City of Zurich Open Data", url: "https://data.stadt-zuerich.ch/", type: "city" },
      { label: "OECD Switzerland", url: "https://www.oecd.org/switzerland/", type: "oecd" }
    ]
  },
  {
    id: "toronto",
    name: "Toronto",
    country: "Canada",
    lat: 43.6532,
    lng: -79.3832,
    aliases: ["Toronto"],
    resources: [
      { label: "City of Toronto Open Data", url: "https://open.toronto.ca/", type: "city" },
      { label: "OECD Canada", url: "https://www.oecd.org/canada/", type: "oecd" }
    ]
  },
  {
    id: "montreal",
    name: "Montreal",
    country: "Canada",
    lat: 45.5019,
    lng: -73.5674,
    aliases: ["Montreal", "Montréal"],
    resources: [
      { label: "Montréal Données ouvertes", url: "https://donnees.montreal.ca/", type: "city" },
      { label: "OECD Canada", url: "https://www.oecd.org/canada/", type: "oecd" }
    ]
  },
  {
    id: "sydney",
    name: "Sydney",
    country: "Australia",
    lat: -33.8688,
    lng: 151.2093,
    aliases: ["Sydney"],
    resources: [
      { label: "City of Sydney Data Hub", url: "https://data.cityofsydney.nsw.gov.au/", type: "city" },
      { label: "OECD Australia", url: "https://www.oecd.org/australia/", type: "oecd" }
    ]
  },
  {
    id: "melbourne",
    name: "Melbourne",
    country: "Australia",
    lat: -37.8136,
    lng: 144.9631,
    aliases: ["Melbourne"],
    resources: [
      { label: "City of Melbourne Open Data", url: "https://data.melbourne.vic.gov.au/", type: "city" },
      { label: "OECD Australia", url: "https://www.oecd.org/australia/", type: "oecd" }
    ]
  },
  {
    id: "dubai",
    name: "Dubai",
    country: "United Arab Emirates",
    lat: 25.2048,
    lng: 55.2708,
    aliases: ["Dubai"],
    resources: [
      { label: "Smart Dubai", url: "https://www.smartdubai.ae/", type: "city" },
      { label: "OECD MENA", url: "https://www.oecd.org/mena/", type: "oecd" }
    ]
  },
  {
    id: "istanbul",
    name: "Istanbul",
    country: "Türkiye",
    lat: 41.0082,
    lng: 28.9784,
    aliases: ["Istanbul"],
    resources: [
      { label: "Istanbul Metropolitan Municipality", url: "https://www.ibb.istanbul/en", type: "city" },
      { label: "OECD Türkiye", url: "https://www.oecd.org/turkiye/", type: "oecd" }
    ]
  },
  {
    id: "beijing",
    name: "Beijing",
    country: "China",
    lat: 39.9042,
    lng: 116.4074,
    aliases: ["Beijing"],
    resources: [
      { label: "Beijing Municipal Government", url: "https://english.beijing.gov.cn/", type: "city" },
      { label: "OECD China", url: "https://www.oecd.org/china/", type: "oecd" }
    ]
  },
  {
    id: "shanghai",
    name: "Shanghai",
    country: "China",
    lat: 31.2304,
    lng: 121.4737,
    aliases: ["Shanghai"],
    resources: [
      { label: "Shanghai Open Data", url: "https://data.sh.gov.cn/", type: "city" },
      { label: "OECD China", url: "https://www.oecd.org/china/", type: "oecd" }
    ]
  }
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sentenceSplit(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 30);
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const pdfPath = path.join(root, PDF_FILE);
  const outPath = path.join(root, OUTPUT_FILE);
  const outDir = path.dirname(outPath);

  const pdfBuffer = await fs.readFile(pdfPath);
  const parsed = await pdfParse(pdfBuffer);
  const fullText = String(parsed.text || "");
  const sentences = sentenceSplit(fullText);

  const places = PLACE_CATALOG.map((place) => {
    const snippets = new Set();
    let mentions = 0;

    for (const sentence of sentences) {
      let matched = false;
      for (const alias of place.aliases) {
        const matcher = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
        if (matcher.test(sentence)) {
          matched = true;
          break;
        }
      }

      if (!matched) continue;
      mentions += 1;
      snippets.add(sentence);
    }

    const dedupedSnippets = Array.from(snippets).slice(0, 6);
    return {
      id: place.id,
      name: place.name,
      country: place.country,
      coordinates: {
        lat: place.lat,
        lng: place.lng
      },
      mentions,
      snippets: dedupedSnippets,
      resources: place.resources
    };
  })
    .filter((entry) => entry.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));

  const payload = {
    generatedAt: new Date().toISOString(),
    sourcePdf: PDF_FILE,
    sourceStats: {
      pages: parsed.numpages || null,
      totalSentences: sentences.length
    },
    places
  };

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Extracted ${places.length} places to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("Failed to extract place mentions:", error);
  process.exitCode = 1;
});
