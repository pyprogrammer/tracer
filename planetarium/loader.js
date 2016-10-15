(function() {
   var elem = (document.head || document.documentElement);
   var firstChild = null;
   var port = chrome.runtime.connect({name:"requests"});
   port.postMessage({enable:false});

   function createScript(name) {
      var s = document.createElement('script');
      s.src = chrome.extension.getURL(name);
      s.setAttribute("sandbox", "0");
      s.onload = function () {
         this.remove();
      };
      if (firstChild == null) {
         firstChild = elem.firstChild;
      }
      elem.insertBefore(s, firstChild);
   }

   document.addEventListener("DOMContentLoaded", function (event) {
      var rand = Math.random();
      port.postMessage({enable: true, messageID: rand});
      chrome.runtime.onMessage.addListener(function listen(message, sender, callback) {
         if (message.messageID == rand) {
            createScript("bower_components/stackframe/stackframe.js");
            createScript("bower_components/error-stack-parser/error-stack-parser.js");
            createScript("bower_components/esprima/esprima.js");
            createScript("blacklist.js");
            createScript("sandbox.js");
            createScript("tracer.js");
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
