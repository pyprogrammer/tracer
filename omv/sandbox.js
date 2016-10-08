function generateWrapper(codeString) {
   return 
      "var window = null;" +
      "var document = null;" +
      "var context = { window: window, document: document };" +
      "var eval = getEval(context);" +
      "(function() { " + codeString + "});"; 
}

function sandbox(scriptTag) {
   if (scriptTag.hasAttribute('src')) {
      var scriptURL = scriptTag.getAttribute('src');
      var request = new XMLHttpRequest();
      request.open('GET', scriptURL, false);
      request.send();
      scriptTag.removeAttribute('src');
      scriptTag.innerHTML = generateWrapper(request.responseText);
   } else {
      scriptTag.innerHTML = generateWrapper(scriptTag.innerHTML);
   }
}

function getEval(context) {
   function newEval(s) {
      var indirect = function(s) {
         eval(s);
      };
      return indirect.call(context, s);
   };
   return newEval;
}
