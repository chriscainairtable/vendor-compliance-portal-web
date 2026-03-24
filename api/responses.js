const BASE_ID      = 'app2IUNGEv1dFXlx9';
const RESPONSES_ID = 'tblBZO2wJBLZt5uZz';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return res.status(500).json({ error: 'AIRTABLE_PAT not configured' });

  try {
    const { fields } = req.body;
    const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${RESPONSES_ID}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, typecast: true }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message || 'Airtable write error');
    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
