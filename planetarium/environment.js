/**
 * Created by nzhang-dev on 11/25/16.
 */

function MockWindow(trust) {
   return window;
   var that = this;
   var shortCircuitedFunctions = {
      "confirm": false,
      "alert": false
   };
   for (var attrib in window) {
      (function(name) {
         Object.defineProperty(that, name, {
            get: function () {
               if (name in shortCircuitedFunctions && !trust) {
                  return (function() { return shortCircuitedFunctions[name]});
               }
               return window[name];
            }
         });
      })(attrib);
   }
}



(function(){
   var count = 0;
   var current = 0;
   function asyncLoadExecute(src) {
      var request = new XMLHttpRequest();
      var cnt = count++;
      request.open('GET', src, true);
      request.timeout = 1000;
      request.onreadystatechange = function() {
         if (request.readyState != XMLHttpRequest.DONE || request.status != 200) {
            return;
         }
         var interval = setInterval(function(){
            if (current == cnt) {
               current++;
               clearInterval(interval);
               window.eval(generateWrapper(instrumentCode(request.responseText), !blacklisted(src)));
            }
         }, 10);
      };
      request.send();
   }

   function addInstrumentation(node) {
      if (node.src) {
         asyncLoadExecute(node.src);
         node.src = "";
      } else {
         var code = instrumentScript(node.innerHTML, node.src);
         var cnt = count++;
         var interval = setInterval(function(){
            if (current == cnt) {
               current++;
               clearInterval(interval);
               window.eval(code);
            }
         }, 10);
      }
   }
   // Mock Node methods
   var names = {
      "appendChild": function(node) {
         if (!(this.getRootNode() === document))
            return old["appendChild"].call(this, node);
         // do a sweep through the child nodes that are scripts
         if (node.tagName === "SCRIPT") {
            addInstrumentation(node);
         } else {
            Array.prototype.forEach.call(node.getElementsByTagName("script"), addInstrumentation);
         }
         return old["appendChild"].call(this, node);
      },
      "insertBefore": function(node, before) {
         if (!(this.getRootNode() === document))
            return old["insertBefore"].call(this, node, before);
         // do a sweep through the child nodes that are scripts
         if (node.tagName === "SCRIPT") {
            addInstrumentation(node);
         } else {
            Array.prototype.forEach.call(node.getElementsByTagName("script"), addInstrumentation);
         }
         return old["insertBefore"].call(this, node, before);
      }
   };
   var old = {};
   for (var method in names) {
      old[method] = HTMLElement.prototype[method];
      HTMLElement.prototype[method] = function () {
         var that = this;
         return names[method].apply(that, arguments);
      }
   }
})();

document.write = function(){};


untrustedParam = new MockWindow(false);
trustedParam = new MockWindow(true);

