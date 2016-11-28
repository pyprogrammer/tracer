(function() {

   /*
    Create script to place into page
    */

   var elem = (document.head || document.documentElement);
   var firstChild = null;
   var port = chrome.runtime.connect({name:"requests"});
   port.postMessage({enable:false});

   function createScript(name) {
      var s = document.createElement('script');
      var scriptURL = chrome.extension.getURL(name);
      var request = new XMLHttpRequest();
      request.open('GET', scriptURL, false);
      request.send();
      var newCode = request.responseText;
      var s2 = document.createElement("script");
      s2.setAttribute("sandbox", "0");
      s2.innerHTML = newCode;
      elem.insertBefore(s2, firstChild);
      elem.removeChild(s2);

   }

   function pageInject(name) {
      var scriptURL = chrome.extension.getURL(name);
      var request = new XMLHttpRequest();
      request.open('GET', scriptURL, false);
      request.send();
      var newCode = request.responseText;
      var s2 = document.createElement("script");
      s2.setAttribute("sandbox", "0");
      s2.innerHTML = newCode;
      elem.insertBefore(s2, firstChild);
   }

   document.addEventListener("DOMContentLoaded", function (event) {
      var rand = Math.random();
      port.postMessage({enable: true, messageID: rand});
      chrome.runtime.onMessage.addListener(function listen(message, sender, callback) {
         if (message.messageID == rand) {
            createScript("deps/stackframe.js");
            createScript("deps/error-stack-parser.js");
            createScript("deps/esprima.js");
            createScript("deps/escodegen.browser.js");
            createScript("blacklist.js");
            createScript("sandbox.js");
            createScript("tracer.js");
            pageInject("environment.js");
            // setup();
            var scripts = Array.prototype.slice.apply(document.getElementsByTagName('script'));
            for (i = 0; i < scripts.length; ++i) {
               sandbox(scripts[i]);
            }
            chrome.runtime.onMessage.removeListener(listen);
         }
      });
   });

   window.addEventListener("beforeunload", function (event) {
      port.postMessage({enable: false});
   });

})();
