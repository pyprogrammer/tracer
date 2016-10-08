(function () {
   var elem = (document.head || document.documentElement);

   function createScript(name) {
      var s = document.createElement('script');
      s.src = chrome.extension.getURL(name);
      s.onload = function () {
         this.remove();
      };
      elem.insertBefore(s, elem.firstChild);
   }

   var scripts = document.getElementsByTagName('script');
   for (i = 0; i < scripts.length; ++i) {
      sandbox(scripts[i]);
   }

   createScript("blacklist.js");
   createScript("tracer.js");
   createScript("sandbox.js");
   createScript("error-stack-parser.min.js");
})();
