var express = require('express');
var {shopifyApi, RequestedTokenType} = require('@shopify/shopify-api');

var router = express.Router();
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  apiVersion: 'unstable',
  appUrl: process.env.SHOPIFY_APP_URL || '',
  scopes: process.env.SCOPES?.split(','),
  hostScheme: process.env.HOST?.split('://')[0],
  hostName: process.env.HOST?.replace(/https?:\/\//, ''),
  isEmbeddedApp: true,
});

// [START auth.token-in-header]
function getSessionTokenHeader(request) {
  return request.headers['authorization']?.replace('Bearer ', '');
}
// [END auth.token-in-header]

// [START auth.token-in-url-param]
function getSessionTokenFromUrlParam(request) {
  const searchParams = new URLSearchParams(request.url);

  return searchParams.get('id_token');
}
// [END auth.token-in-url-param]

// [START auth.session-token-bounce-redirect]
function redirectToSessionTokenBouncePage(req, res) {
  const searchParams = new URLSearchParams(req.query);
  // Remove `id_token` from the query string to prevent an invalid session token sent to the redirect path.
  searchParams.delete('id_token');

  // Using shopify-reload path to redirect the bounce automatically.
  searchParams.append(
    'shopify-reload',
    `${req.path}?${searchParams.toString()}`
  );
  res.redirect(`/session-token-bounce?${searchParams.toString()}`);
}

router.get('/session-token-bounce', async function (req, res, next) {
  res.setHeader("Content-Type", "text/html");
  // "process.env.SHOPIFY_API_KEY" is available if you use Shopify CLI to run your app.
  // You can also replace it with your App's Client ID manually.
  const html = `
  <head>
      <meta name="shopify-api-key" content="${process.env.SHOPIFY_API_KEY}" />
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  </head>
  `;
  res.send(html);
});
// [END auth.session-token-bounce-redirect]

router.get('/authorize', async function (req, res, next) {
  let encodedSessionToken = null;
  let decodedSessionToken = null;
  try {
    // [START auth.get-session-token]
    encodedSessionToken =
      getSessionTokenHeader(req) || getSessionTokenFromUrlParam(req);
    // [END auth.get-session-token]

    // [START auth.validate-session-token]
    // "shopify" is an instance of the Shopify API library object,
    // You can install and configure the Shopify API library through: https://www.npmjs.com/package/@shopify/shopify-api
    decodedSessionToken = await shopify.session.decodeSessionToken(
      encodedSessionToken
    );
  } catch (e) {
    // Handle invalid session token error
    const isDocumentRequest = !request.headers.get("authorization");
    if (isDocumentRequest) {
      return redirectToSessionTokenBouncePage(req, res);
    }

    throw new Response(undefined, {
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({
        'X-Shopify-Retry-Invalid-Session-Request': '1',
      }),
    });
  }
  // [END auth.validate-session-token]

  // [START auth.token-exchange]
  const dest = new URL(decodedSessionToken.dest);
  const shop = dest.hostname;
  const accessToken = await shopify.auth.tokenExchange({
    shop,
    sessionToken: encodedSessionToken,
    requestedTokenType: RequestedTokenType.OnlineAccessToken, // or RequestedTokenType.OfflineAccessToken
  });
  // [END auth.token-exchange]

  res.setHeader("Content-Type", "text/html");
  const html = `
  <body>
    <h1>Retrieved access Token</h1>
    <p>${JSON.stringify(accessToken, null, 2)}</p>
  </body>`;
  res.send(html);
});

module.exports = router;
