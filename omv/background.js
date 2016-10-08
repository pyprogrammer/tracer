/**
 * Created by nzhang-dev on 10/7/16.
 */

var blockHeaders = true;
var onHeadersReceived = function(details) {
   var headers = details.responseHeaders;
   if (blockHeaders) {
      headers.push({
         'name': 'Content-Security-Policy',
         'value': "script-src 'none'"
      });
      return { responseHeaders: headers };
   }
   return details;
};

chrome.webRequest.onHeadersReceived.addListener(
   onHeadersReceived,
   {
      'urls': [
         "http://*/*",
         "https://*/*"
      ]
   },
   ['blocking', 'responseHeaders']
);

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
   blockHeaders = message;
});