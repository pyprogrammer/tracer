var elem = (document.head || document.documentElement);

function createScript(name) {
   var s = document.createElement('script');
   s.src = chrome.extension.getURL(name);
   s.onload = function() {
      this.remove();
   };
   elem.insertBefore(s, elem.firstChild);
}

createScript("tracer.js");
createScript("error-stack-parser.min.js");
