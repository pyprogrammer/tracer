var elem = (document.head || document.documentElement);

function createScript(name) {
   var s = document.createElement('script');
   s.src = chrome.extension.getURL(name);
   s.onload = function () {
      this.remove();
   };
   elem.insertBefore(s, elem.firstChild);
}

createScript("blacklist.js");
createScript("tracer.js");
createScript("sandbox.js");
createScript("error-stack-parser.min.js");

document.addEventListener("DOMContentLoaded", function(event) {
   chrome.runtime.sendMessage(false);
   console.log("enabled loading");
   var scripts = document.getElementsByTagName('script');
   for (i = 0; i < scripts.length; ++i) {
      sandbox(scripts[i]);
   }
});

window.addEventListener("beforeunload", function(event) {
   chrome.runtime.sendMessage(true);
});