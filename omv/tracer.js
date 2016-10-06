(function () {
   // TODO: Hide vars

   var trusted = [
      "localhost"
   ];

   var untrusted = [
      "localhost:8000/adblock-breaker.js"
   ];

   traces = {
      "createElement": []
   };

   function isTrusted(trace) {
      for (var i = 0; i < trace.length; i++) {
         for (var j = 0; j < untrusted.length; j++) {
            if ((trace[i].fileName.indexOf(untrusted[j])) != -1) {
               return false;
            }
         }
      }
      return true;
   }

   dataTags = {};
   tags = 0;
   var old_createElement = document.createElement;
   document.createElement = function(tagName) {
      console.log("Create");
      var trace = ErrorStackParser.parse(new Error());
      traces["createElement"].push(trace);
      var el = old_createElement.call(document, tagName);
      el.attributes["metadata-tag"] = tags;
      dataTags[tags] = isTrusted(trace);
      tags += 1;
      return el;
   };
})();
