export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') {
    return res.status(200).json({ error: 'Use POST' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(200).json({ error: 'API key not set. Add ANTHROPIC_API_KEY in Vercel Environment Variables, then redeploy.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    if (!body || typeof body !== 'object') body = {};

    const prompt = body.prompt || 'Say hello.';
    const useWebSearch = body.useWebSearch === true;
    const document = body.document;     // base64 string (no data: prefix)
    const mediaType = body.mediaType;   // e.g. application/pdf, image/png

    // Build message content. If a document is attached, include it.
    let content;
    if (document && mediaType) {
      const docBlock = mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: document } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: document } };
      content = [docBlock, { type: 'text', text: prompt }];
    } else {
      content = prompt;
    }

    const payload = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    };

    if (useWebSearch) {
      payload.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      const msg = (data && data.error && data.error.message) ? data.error.message : 'Anthropic API error';
      return res.status(200).json({ error: msg });
    }

    const text = (data.content || [])
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    return res.status(200).json({ text: text || 'No response generated.' });
  } catch (error) {
    return res.status(200).json({ error: 'Server error: ' + (error.message || String(error)) });
  }
}
