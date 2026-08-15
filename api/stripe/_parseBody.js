export async function parseJsonBody(req) {
  if (!req) {
    return {};
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.json === 'function') {
    return await req.json();
  }

  if (typeof req.text === 'function') {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  }

  return new Promise((resolve, reject) => {
    let body = '';

    if (typeof req.on !== 'function') {
      return resolve({});
    }

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}
