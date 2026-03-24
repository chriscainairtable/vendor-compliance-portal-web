const BASE_ID = 'app2IUNGEv1dFXlx9';
const TABLES  = {
  vendors:   'tblKCOLHyi4TLxVkG',
  projects:  'tblZ3XRHeDxn1vO1W',
  products:  'tblQR0h5O4EicV4mn',
  responses: 'tblBZO2wJBLZt5uZz',
};

async function fetchAll(tableId, pat) {
  const records = [];
  let offset = null;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res  = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Airtable error');
    records.push(...(json.records || []));
    offset = json.offset || null;
  } while (offset);
  return records;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return res.status(500).json({ error: 'AIRTABLE_PAT not configured' });

  try {
    const [vendors, projects, products, responses] = await Promise.all([
      fetchAll(TABLES.vendors,   pat),
      fetchAll(TABLES.projects,  pat),
      fetchAll(TABLES.products,  pat),
      fetchAll(TABLES.responses, pat),
    ]);
    res.status(200).json({ vendors, projects, products, responses });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
