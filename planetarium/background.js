/**
 * Created by nzhang-dev on 10/7/16.
 */

var managedPorts = {};

var isEnabled = function(tabID) {
   if (!(tabID in managedPorts)) {
      console.log("New tab:" + tabID);
      return false;
   }
   return managedPorts[tabID].enable;
};

var onSendHeaders = function(details) {
   if (details.type === "xmlhttprequest")
      console.log({send: true, details: details});
   return details
};

var onHeadersReceived = function(details) {
   var headers = details.responseHeaders;
   if (details.type === "xmlhttprequest")
      console.log({details: details, enabled: isEnabled(details.tabId)});
   if (!isEnabled(details.tabId)) {
      headers.push({
         'name': 'Content-Security-Policy',
         'value': "script-src 'none' 'unsafe-eval'"
      });
      headers.push({
         'name': 'Access-Control-Allow-Origin',
         'value': '*'
      });
   } else {
      headers.push({
         'name': 'Access-Control-Allow-Origin',
         'value': '*'
      });
   }
   return { responseHeaders: headers };
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

chrome.webRequest.onSendHeaders.addListener(
   onSendHeaders,
   {
      'urls': [
         "http://*/*",
         "https://*/*"
      ]
   },
   []
);

chrome.runtime.onConnect.addListener(function(port) {
   console.log("Opening connection:" + port.sender.tab.id);
   console.log(port);
   port.onMessage.addListener(function(request, send, response){
      console.log("setting: " + send.sender.tab.id +" " + request.enable);
      managedPorts[send.sender.tab.id] = request;
      var id = request.messageID;
      chrome.tabs.sendMessage(send.sender.tab.id, {messageID: id});
   });
});