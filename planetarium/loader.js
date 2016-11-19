(function() {

   /*
    Create script to place into page
    */
   function setup () {
      var codeBlocks = [];
      codeBlocks.push(mockWindow.toString());
      codeBlocks.push("var untrustedParam = new mockWindow();");

      var codeScript = document.createElement("script");
      for (var i = 0; i < codeBlocks.length; i++)
      {
         codeScript.innerText += codeBlocks[i] + "\n";
      }
      codeScript.setAttribute("sandbox", "0");
      document.head.appendChild(codeScript);
   }

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
            createScript("deps/stackframe.js");
            createScript("deps/error-stack-parser.js");
            createScript("deps/esprima.js");
            createScript("deps/escodegen.browser.js");
            createScript("blacklist.js");
            createScript("sandbox.js");
            createScript("tracer.js");
            setup();
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
