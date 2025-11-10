import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dgram from "dgram";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/stream/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    const authHeader = req.headers.authorization;
    const tokenFromQuery = (req.query.token as string | undefined) || undefined;
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader
      : tokenFromQuery
      ? `Bearer ${tokenFromQuery}`
      : undefined;

    if (!bearer) {
      res.status(401).json({ error: "Missing access token" });
      return;
    }

    const range = req.headers.range as string | undefined;
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media`;

    const headers: Record<string, string> = { Authorization: bearer };
    if (range) headers.Range = String(range);

    const driveRes = await fetch(driveUrl, { headers });

    res.status(driveRes.status);

    const passthroughHeaders = [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
      "cache-control",
      "etag",
      "last-modified",
    ];
    for (const [k, v] of driveRes.headers.entries()) {
      if (passthroughHeaders.includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");

    if ((driveRes as any).body) {
      (driveRes.body as any).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Proxy error", err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

// UPnP/DLNA Discovery using SSDP (Simple Service Discovery Protocol)
const discoverUPnPDevices = async (): Promise<any[]> => {
  const devices: any[] = [];
  const searchTargets = [
    'urn:schemas-upnp-org:device:MediaRenderer:1',
    'urn:schemas-upnp-org:device:MediaServer:1',
    'urn:dial-multiscreen-org:service:dial:1',
    'urn:schemas-sony-com:service:ScalarWebAPI:1',
  ];

  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const discoveredDevices = new Map<string, any>();
    let timeout: NodeJS.Timeout;

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.setMulticastTTL(128);
      
      // Send M-SEARCH requests for each search target
      searchTargets.forEach((st) => {
        const searchMessage = [
          'M-SEARCH * HTTP/1.1',
          'HOST: 239.255.255.250:1900',
          'MAN: "ssdp:discover"',
          `ST: ${st}`,
          'MX: 3',
          '',
          '',
        ].join('\r\n');

        socket.send(searchMessage, 1900, '239.255.255.250');
      });

      // Listen for responses
      socket.on('message', (msg, rinfo) => {
        const response = msg.toString();
        const lines = response.split('\r\n');
        
        let location = '';
        let usn = '';
        let st = '';
        let server = '';
        let friendlyName = '';

        lines.forEach((line) => {
          const [key, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          
          if (key.toLowerCase() === 'location') {
            location = value;
          } else if (key.toLowerCase() === 'usn') {
            usn = value;
          } else if (key.toLowerCase() === 'st') {
            st = value;
          } else if (key.toLowerCase() === 'server') {
            server = value;
          }
        });

        if (location && usn) {
          const deviceId = usn.split('::')[0] || usn;
          
          if (!discoveredDevices.has(deviceId)) {
            // Try to get friendly name from device description
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            fetch(location, { signal: controller.signal })
              .then((res) => res.text())
              .finally(() => clearTimeout(timeout))
              .then((xml) => {
                const friendlyNameMatch = xml.match(/<friendlyName>(.*?)<\/friendlyName>/i);
                const modelNameMatch = xml.match(/<modelName>(.*?)<\/modelName>/i);
                const manufacturerMatch = xml.match(/<manufacturer>(.*?)<\/manufacturer>/i);
                
                friendlyName = friendlyNameMatch?.[1] || modelNameMatch?.[1] || manufacturerMatch?.[1] || '';
                
                discoveredDevices.set(deviceId, {
                  id: deviceId,
                  name: friendlyName || `UPnP Device (${rinfo.address})`,
                  friendlyName: friendlyName || '',
                  type: 'DLNA',
                  url: location,
                  address: rinfo.address,
                  port: rinfo.port,
                  server: server,
                  st: st,
                });
              })
              .catch(() => {
                // If we can't fetch device description, use IP address
                discoveredDevices.set(deviceId, {
                  id: deviceId,
                  name: `UPnP Device (${rinfo.address})`,
                  friendlyName: '',
                  type: 'DLNA',
                  url: location,
                  address: rinfo.address,
                  port: rinfo.port,
                  server: server,
                  st: st,
                });
              });
          }
        }
      });

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        socket.close();
        resolve(Array.from(discoveredDevices.values()));
      }, 5000);
    });

    socket.on('error', (err) => {
      console.error('SSDP discovery error:', err);
      clearTimeout(timeout);
      socket.close();
      resolve([]);
    });
  });
};

// Helper function to parse UPnP device description and find control URL
const getControlURL = async (deviceDescriptionUrl: string, serviceType: string): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(deviceDescriptionUrl, { signal: controller.signal });
    const xml = await response.text();
    clearTimeout(timeout);
    
    // Find the control URL for the service type
    const serviceRegex = new RegExp(`<serviceType>${serviceType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</serviceType>[\\s\\S]*?<controlURL>(.*?)</controlURL>`, 'i');
    const match = xml.match(serviceRegex);
    
    if (match && match[1]) {
      const controlPath = match[1].trim();
      const baseUrl = new URL(deviceDescriptionUrl);
      return `${baseUrl.protocol}//${baseUrl.host}${controlPath}`;
    }
  } catch (error) {
    console.error('Error getting control URL:', error);
  }
  return null;
};

// API endpoint for casting to DLNA/UPnP device
app.post('/api/cast-dlna', async (req, res) => {
  try {
    const { deviceUrl, mediaUrl, title } = req.body;
    
    if (!deviceUrl || !mediaUrl) {
      res.status(400).json({ error: 'Missing deviceUrl or mediaUrl' });
      return;
    }
    
    // Get control URL for AVTransport service
    const controlURL = await getControlURL(deviceUrl, 'urn:schemas-upnp-org:service:AVTransport:1');
    
    if (!controlURL) {
      res.status(404).json({ error: 'Control URL not found' });
      return;
    }
    
    // Create SOAP action to set media URI
    const soapAction = '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"';
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>${mediaUrl}</CurrentURI>
      <CurrentURIMetaData>&lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;&lt;item&gt;&lt;dc:title&gt;${title || 'Track'}&lt;/dc:title&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;</CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>`;
    
    const controller1 = new AbortController();
    const timeout1 = setTimeout(() => controller1.abort(), 5000);
    const response = await fetch(controlURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        'SOAPAction': soapAction,
      },
      body: soapBody,
      signal: controller1.signal,
    });
    clearTimeout(timeout1);
    
    if (response.ok) {
      // Try to play
      const playControlURL = await getControlURL(deviceUrl, 'urn:schemas-upnp-org:service:AVTransport:1');
      if (playControlURL) {
        const playSoapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>`;
        
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 5000);
        await fetch(playControlURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
          },
          body: playSoapBody,
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
      }
      
      res.json({ success: true });
    } else {
      res.status(response.status).json({ error: 'Failed to cast to device' });
    }
  } catch (error: any) {
    console.error('DLNA cast error:', error);
    res.status(500).json({ 
      error: 'Cast failed', 
      message: error.message 
    });
  }
});

// API endpoint for discovering speakers
app.get('/api/discover-speakers', async (req, res) => {
  try {
    const { type } = req.query;
    
    if (type === 'dlna' || type === 'upnp') {
      const devices = await discoverUPnPDevices();
      res.json({ speakers: devices });
    } else if (type === 'sonos') {
      // Sonos also uses UPnP, so we can use the same discovery
      const devices = await discoverUPnPDevices();
      // Filter for Sonos devices (they typically have "Sonos" in server or friendlyName)
      const sonosDevices = devices.filter((d) => 
        d.server?.toLowerCase().includes('sonos') || 
        d.friendlyName?.toLowerCase().includes('sonos')
      );
      res.json({ speakers: sonosDevices });
    } else {
      // Discover all types
      const devices = await discoverUPnPDevices();
      res.json({ speakers: devices });
    }
  } catch (error: any) {
    console.error('Discovery error:', error);
    res.status(500).json({ 
      error: 'Discovery failed', 
      message: error.message 
    });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Drive proxy running on http://0.0.0.0:${port}`);
  console.log(`UPnP/DLNA discovery enabled`);
});



