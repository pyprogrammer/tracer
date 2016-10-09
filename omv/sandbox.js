
function getEval(context) {
   function newEval(s) {
      var indirect = function(s) {
         return eval(s);
      };
      return indirect.call(context, s);
   }
   return newEval;
}

function generateWrapper(codeString) {
   // The context needs to be consistent with the function call below in order to mock the environment
   return "(function(){" +
      getEval.toString() + "\n" +
      "var context = { window: {}, document: null, eval:getEval(context)};\n" +
      "(function(window, document, eval) { \n" + codeString + "\n})({}, null, getEval(context));\n" +
      "})();";
}

function sandbox(scriptTag) {
   var newScript = document.createElement('script');
   if (!scriptTag.hasAttribute("sandbox")) {
      if (scriptTag.hasAttribute('src')) {
         var scriptURL = scriptTag.getAttribute('src');
         var request = new XMLHttpRequest();
         request.open('GET', scriptURL, false);
         request.send();
         scriptTag.removeAttribute('src');
         newScript.innerHTML = generateWrapper(request.responseText);
      } else {
         newScript.innerHTML = generateWrapper(scriptTag.innerHTML);
      }
      scriptTag.parentNode.insertBefore(newScript, scriptTag);
      scriptTag.parentNode.removeChild(scriptTag);
   } else {
      var newScript = scriptTag.cloneNode();
      scriptTag.parentNode.insertBefore(newScript, scriptTag);
      scriptTag.parentNode.removeChild(scriptTag);
   }
}


console.log("sandbox");