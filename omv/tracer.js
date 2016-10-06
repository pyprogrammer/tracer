(function () {
   // TODO: Hide vars
   traces = {
      "createElement": []
   };
   dataTags = {};
   tags = 0;
   var old_createElement = document.createElement;
   document.createElement = function(tagName) {
      console.log("Create");
      var trace = ErrorStackParser.parse(new Error());
      traces["createElement"].push(trace);
      var el = old_createElement.call(document, tagName);
      el.attributes["metadata-tag"] = tags;
      dataTags[tags] = trace;
      tags += 1;
      return el;
   };
})();
