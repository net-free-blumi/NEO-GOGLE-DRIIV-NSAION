// Netlify Function for Google Drive thumbnails
// Proxies thumbnail requests to bypass CORS

exports.handler = async (event) => {
  try {
    // CORS and preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      };
    }

    // Extract file ID from path
    let fileId = event.path.split('/thumbnail/')[1];
    
    if (!fileId) {
      const pathParts = event.path.split('/').filter(p => p && p !== 'thumbnail' && p !== '.netlify' && p !== 'functions');
      fileId = pathParts[pathParts.length - 1];
    }
    
    if (fileId) {
      fileId = fileId.split('?')[0];
    }
    
    if (!fileId || fileId === 'thumbnail' || fileId === '') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing file ID', path: event.path }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }

    // Get token from query parameter or Authorization header
    const tokenFromQuery = event.queryStringParameters?.token;
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    const token = tokenFromQuery || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing access token' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }

    // Get size parameter (default to 800)
    const size = event.queryStringParameters?.sz || '800';

    // Build Google Drive thumbnail URL
    const thumbnailUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/thumbnail?sz=${size}`;
    
    const fetchHeaders = {
      'Authorization': `Bearer ${token}`,
    };

    const thumbnailRes = await fetch(thumbnailUrl, { headers: fetchHeaders });

    if (!thumbnailRes.ok) {
      return {
        statusCode: thumbnailRes.status,
        body: JSON.stringify({ error: 'Thumbnail not found' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }

    // Get image data
    const arrayBuffer = await thumbnailRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = thumbnailRes.headers.get('content-type') || 'image/jpeg';

    return {
      statusCode: 200,
      body: base64,
      isBase64Encoded: true,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    };
  } catch (error) {
    console.error('Thumbnail proxy error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error?.message || 'Internal server error',
        details: error?.stack 
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};

