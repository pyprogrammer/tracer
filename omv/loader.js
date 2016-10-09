(function() {
   var elem = (document.head || document.documentElement);
   var port = chrome.runtime.connect({name:"requests"});
   port.postMessage({enable:false});

   function createScript(name) {
      var s = document.createElement('script');
      s.src = chrome.extension.getURL(name);
      s.setAttribute("sandbox", "0");
      s.onload = function () {
         this.remove();
      };
      elem.insertBefore(s, elem.firstChild);
   }

   document.addEventListener("DOMContentLoaded", function (event) {
      var rand = Math.random();
      port.postMessage({enable: true, messageID: rand});
      console.log("enabled loading");
      chrome.runtime.onMessage.addListener(function listen(message, sender, callback) {
         if (message.messageID == rand) {
            createScript("blacklist.js");
            createScript("tracer.js");
            createScript("sandbox.js");
            createScript("error-stack-parser.min.js");
            var scripts = document.getElementsByTagName('script');
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