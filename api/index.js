export const config = {
  runtime: "edge",
};

const UPSTREAM_URL = (process.env.UPSTREAM_URL || "").replace(/\/$/, "");

const EXCLUDED_KEYS = [
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
];

export default async function routeHandler(req) {
  if (!UPSTREAM_URL) {
    return new Response("System Error: UPSTREAM_URL missing", { status: 500 });
  }

  try {
    const parsedRequest = new URL(req.url);
    const destinationEndpoint = UPSTREAM_URL + parsedRequest.pathname + parsedRequest.search;

    const customHeaders = new Headers();
    let visitorIp = null;
    
    for (const [headerName, headerValue] of req.headers) {
      const lowerHeaderName = headerName.toLowerCase();
      
      if (EXCLUDED_KEYS.includes(lowerHeaderName)) continue;
      if (lowerHeaderName.startsWith("x-vercel-")) continue;
      
      if (lowerHeaderName === "x-real-ip") { 
        visitorIp = headerValue; 
        continue; 
      }
      if (lowerHeaderName === "x-forwarded-for") { 
        if (!visitorIp) visitorIp = headerValue; 
        continue; 
      }
      
      customHeaders.set(lowerHeaderName, headerValue);
    }
    
    if (visitorIp) customHeaders.set("x-forwarded-for", visitorIp);

    const requestMethod = req.method;
    const fetchOptions = {
      method: requestMethod,
      headers: customHeaders,
      redirect: "manual",
    };
    
    if (requestMethod !== "GET" && requestMethod !== "HEAD") {
      fetchOptions.body = req.body;
      fetchOptions.duplex = "half";
    }

    const remoteResponse = await fetch(destinationEndpoint, fetchOptions);
    const finalHeaders = new Headers();
    
    for (const [key, val] of remoteResponse.headers) {
      if (key.toLowerCase() !== "transfer-encoding") {
        finalHeaders.set(key, val);
      }
    }

    return new Response(remoteResponse.body, {
      status: remoteResponse.status,
      headers: finalHeaders,
    });
  } catch (error) {
    return new Response("Service Unavailable", { status: 502 });
  }
}
