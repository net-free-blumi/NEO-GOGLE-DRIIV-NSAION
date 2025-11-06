// Netlify Function for streaming Google Drive audio files
// Uses small chunks (1MB) to avoid size limits

exports.handler = async (event) => {
  try {
    // CORS and preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
        },
      };
    }

    // Extract file ID from path
    let fileId = event.path.split('/stream/')[1];
    
    if (!fileId) {
      const pathParts = event.path.split('/').filter(p => p && p !== 'stream' && p !== '.netlify' && p !== 'functions');
      fileId = pathParts[pathParts.length - 1];
    }
    
    if (fileId) {
      fileId = fileId.split('?')[0];
    }
    
    if (!fileId || fileId === 'stream' || fileId === '') {
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

    // Get range header if present
    const rangeHeader = event.headers['range'] || event.headers['Range'];

    // Build Google Drive URL
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    
    const fetchHeaders = {
      'Authorization': `Bearer ${token}`,
    };
    
    // Parse range header to get start and end
    let start = 0;
    let end = null;
    
    // Default chunk size: 2MB to stay under Netlify's 6MB limit
    const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
    
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1], 10);
        if (match[2]) {
          end = parseInt(match[2], 10);
        } else {
          // If no end specified, limit to default chunk size
          end = start + DEFAULT_CHUNK_SIZE - 1;
        }
      }
    } else {
      // No range header - limit to first chunk to avoid loading entire file
      end = DEFAULT_CHUNK_SIZE - 1;
    }
    
    // Always set Range header to limit chunk size
    fetchHeaders['Range'] = `bytes=${start}-${end}`;

    const driveRes = await fetch(driveUrl, { headers: fetchHeaders });

    if (!driveRes.ok) {
      const errorText = await driveRes.text().catch(() => 'Unknown error');
      return {
        statusCode: driveRes.status,
        body: JSON.stringify({ error: `Drive API error: ${errorText}` }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      };
    }

    // Get response body as stream
    const arrayBuffer = await driveRes.arrayBuffer();
    const actualChunkSize = arrayBuffer.byteLength;
    
    // Get total file size from Content-Range header if available
    let totalSize = null;
    const contentRangeHeader = driveRes.headers.get('content-range');
    if (contentRangeHeader) {
      const match = contentRangeHeader.match(/bytes \d+-\d+\/(\d+)/);
      if (match) {
        totalSize = parseInt(match[1], 10);
      }
    }
    
    // Convert to base64 for Netlify
    // Note: Netlify has a 6MB limit for response body, but we handle range requests
    // so we only return the requested chunk, not the entire file
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Prepare response headers
    const responseHeaders = {
      'Content-Type': driveRes.headers.get('content-type') || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
      'Content-Length': actualChunkSize.toString(),
    };

    // Set Content-Range header if we have range info
    if (rangeHeader || contentRangeHeader) {
      const actualEnd = start + actualChunkSize - 1;
      if (totalSize !== null) {
        responseHeaders['Content-Range'] = `bytes ${start}-${actualEnd}/${totalSize}`;
      } else {
        responseHeaders['Content-Range'] = `bytes ${start}-${actualEnd}/*`;
      }
    }

    // Always return 206 (Partial Content) since we're always returning chunks
    // This tells the browser to expect more data and make additional range requests
    const statusCode = 206;

    return {
      statusCode,
      body: base64,
      isBase64Encoded: true,
      headers: responseHeaders,
    };
  } catch (error) {
    console.error('Stream error:', error);
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
