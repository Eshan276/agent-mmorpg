const AXIOM_TOKEN   = process.env.AXIOM_TOKEN;
const AXIOM_DATASET = process.env.AXIOM_DATASET ?? 'agent-mmorpg';
const AXIOM_ORG     = process.env.AXIOM_ORG_ID ?? '';

export async function logsHandler(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (!AXIOM_TOKEN) {
    res.writeHead(503).end(JSON.stringify({ error: 'Axiom not configured' }));
    return;
  }

  const agentId = url.searchParams.get('agentId') ?? '';
  const limit   = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500);

  const aplQuery = agentId
    ? `['${AXIOM_DATASET}'] | where agentId == "${agentId}" | sort by _time desc | limit ${limit}`
    : `['${AXIOM_DATASET}'] | sort by _time desc | limit ${limit}`;

  try {
    const axiomRes = await fetch('https://api.axiom.co/v1/datasets/_apl?format=tabular', {
      method:  'POST',
      headers: {
        'Authorization':  `Bearer ${AXIOM_TOKEN}`,
        'Content-Type':   'application/json',
        ...(AXIOM_ORG ? { 'X-Axiom-Org-Id': AXIOM_ORG } : {}),
      },
      body: JSON.stringify({
        apl:       aplQuery,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endTime:   new Date().toISOString(),
      }),
    });

    if (!axiomRes.ok) {
      const text = await axiomRes.text();
      res.writeHead(axiomRes.status).end(JSON.stringify({ error: text }));
      return;
    }

    const data = await axiomRes.json();
    // Tabular format: flatten to array of objects
    const rows = [];
    for (const table of data.tables ?? []) {
      const fields = table.fields ?? [];
      for (const row of table.columns?.[0] ? zip(table.columns, fields) : []) {
        // zip columns into object by field name
        const obj = {};
        fields.forEach((f, i) => { obj[f.name] = table.columns[i]?.[rows.length] ?? null; });
        rows.push(obj);
      }
      // simpler: iterate rows via indices
      rows.length = 0;
      const cols = table.columns ?? [];
      const count = cols[0]?.length ?? 0;
      for (let i = 0; i < count; i++) {
        const obj = {};
        fields.forEach((f, ci) => { obj[f.name] = cols[ci]?.[i] ?? null; });
        rows.push(obj);
      }
    }

    res.writeHead(200).end(JSON.stringify(rows));
  } catch (err) {
    res.writeHead(500).end(JSON.stringify({ error: err.message }));
  }
}

function zip(cols, fields) { return []; } // unused helper placeholder
