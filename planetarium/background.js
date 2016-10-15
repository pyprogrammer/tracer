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

var onHeadersReceived = function(details) {
   var headers = details.responseHeaders;
   console.log(details);
   if (!isEnabled(details.tabId)) {
      console.log("enabled: " + details.tabId);
      headers.push({
         'name': 'Content-Security-Policy',
         'value': "script-src 'none' 'unsafe-eval'"
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