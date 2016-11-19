(function () {
   // TODO: Hide vars

   var trusted = [
      "localhost"
   ];

   var untrusted = [
      "localhost:8000/adblock-breaker.js"
   ];

   var traces = {
      "createElement": []
   };

   // Catch "new Function" by overwriting Function (yes, it's possible and
   // turns out to be totally OK).
   __functionHandle = Function;
   Function = function() {
      arguments[arguments.length-1] = instrument(arguments[arguments.length-1]);
      __functionHandle.apply(this, arguments);
   }

   var newDocument = document.cloneNode(true);

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

   var cloned_old_createElement = newDocument.createElement;
   newDocument.createElement = function(tagName) {
      console.log("New Create");
      var trace = ErrorStackParser.parse(new Error());
      traces["createElement"].push(trace);
      var el = old_createElement.call(newDocument, tagName);
      el.attributes["metadata-tag"] = tags;
      dataTags[tags] = isTrusted(trace);
      tags += 1;
      return el;
   };

   var properties = ["documentElement", "body"];
   var backups = {};

   properties.forEach(
      function(val, index, arr) {
         backups[val] = document[val];
         Object.defineProperty(
            document, val, {
               get: function() {
                  var trusted = isTrusted(ErrorStackParser.parse(new Error));
                  console.log(val);
                  console.log(trusted);
                  // if(!trusted) {
                  //    return newDocument[val];
                  // }
                  return backups[val];
               }
            }
         )
      }
   );
})();
