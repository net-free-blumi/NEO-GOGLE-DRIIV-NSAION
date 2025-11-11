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
    // Netlify Functions: event.path is like "/.netlify/functions/thumbnail/{fileId}"
    // or "/thumbnail/{fileId}" depending on routing
    let fileId = event.path;
    
    // Remove leading slashes and function name
    if (fileId.includes('/thumbnail/')) {
      fileId = fileId.split('/thumbnail/')[1];
    } else if (fileId.startsWith('/thumbnail')) {
      fileId = fileId.replace('/thumbnail', '').replace(/^\//, '');
    } else {
      // Try to get from path parts
      const pathParts = fileId.split('/').filter(p => p && p !== 'thumbnail' && p !== '.netlify' && p !== 'functions' && p !== '');
      fileId = pathParts[pathParts.length - 1];
    }
    
    // Remove query string if present
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

    // First, try to get thumbnailLink from file metadata
    try {
      const fileInfoUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink,hasThumbnail`;
      const fileInfoRes = await fetch(fileInfoUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (fileInfoRes.ok) {
        const fileInfo = await fileInfoRes.json();
        if (fileInfo.thumbnailLink) {
          // Use thumbnailLink directly (it's a Google-hosted image URL)
          const thumbnailLinkRes = await fetch(fileInfo.thumbnailLink);
          if (thumbnailLinkRes.ok) {
            const arrayBuffer = await thumbnailLinkRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = thumbnailLinkRes.headers.get('content-type') || 'image/jpeg';
            
            return {
              statusCode: 200,
              body: base64,
              isBase64Encoded: true,
              headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600',
              },
            };
          }
        }
      }
    } catch (e) {
      // Fall through to thumbnail endpoint
    }

    // Fallback: Try thumbnail endpoint
    const thumbnailUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/thumbnail?sz=${size}`;
    
    const fetchHeaders = {
      'Authorization': `Bearer ${token}`,
    };

    const thumbnailRes = await fetch(thumbnailUrl, { headers: fetchHeaders });

    if (!thumbnailRes.ok) {
      // Return 404 if thumbnail doesn't exist
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Thumbnail not found', status: thumbnailRes.status }),
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

