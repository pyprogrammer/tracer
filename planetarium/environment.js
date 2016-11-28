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
   // Mock Node methods
   var names = [
      "appendChild",
      "insertBefore",
      "removeChild",
      "replaceChild"
   ];
   for (var index in names) {
      (function(name) {
         var old = Node.prototype[name];
         function old(){};
         Node.prototype[name] = function() {
            console.log(name);
            console.log(arguments);
            var that = this;
            debugger;
            return old.apply(that, arguments);
         };
      })(names[index]); // Prevent scoping problems
   }
})();


var untrustedParam = new MockWindow(false);
var trustedParam = new MockWindow(true);