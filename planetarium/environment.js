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
   function addInstrumentation(node) {
      if (node.src) {
         node.innerHTML = getText(node.src);
         node.src = "";
      }
      node.innerHTML = generateWrapper(instrumentCode(node.innerHTML, blacklisted(node.src)));
   }
   // Mock Node methods
   var names = {
      "appendChild": function(node) {
         console.log(node);
         console.log("appendChild");
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
         console.log(node);
         console.log("insertBefore");
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

   var old = {

   };
   for (var method in names) {
      old[method] = HTMLElement.prototype[method];
      HTMLElement.prototype[method] = function () {
         var that = this;
         return names[method].apply(that, arguments);
      }
   }
})();


var untrustedParam = new MockWindow(false);
var trustedParam = new MockWindow(true);