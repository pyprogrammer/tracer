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
               if (name in shortCircuitedFunctions) {
                  return (function() { return shortCircuitedFunctions[name]});
               }
               return window[name];
            }
         });
      })(attrib);
   }
}


var untrustedParam = new MockWindow(false);
var trustedParam = new MockWindow(true);